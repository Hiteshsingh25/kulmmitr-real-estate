import { PrismaClient } from '@prisma/client';
import { 
  WorkflowDefinition, 
  WorkflowNode, 
  WorkflowEdge, 
  StepResult, 
  TriggerNodeData, 
  ConditionNodeData, 
  ActionNodeData 
} from '../types';
import { whatsappService } from './whatsappService';

const prisma = new PrismaClient();
const MAX_STEPS = 50; // Safeguard against circular loops

export class WorkflowProcessor {
  /**
   * Main entry point when a webhook receives a message
   */
  public static async handleIncomingMessage(workspaceId: string, contactId: string, messageText: string, externalMessageId?: string): Promise<void> {
    console.log(`[WorkflowProcessor] Handling webhook for Workspace: ${workspaceId}, Contact: ${contactId}, Message: "${messageText}", ExternalMessageID: ${externalMessageId || 'none'}`);

    // Deduplication check
    if (externalMessageId) {
      try {
        const existingExecution = await prisma.workflowExecution.findUnique({
          where: { externalMessageId }
        });
        if (existingExecution) {
          console.log(`[WorkflowProcessor] Duplicate Meta message detected: "${externalMessageId}". Skipping execution to prevent duplicates.`);
          return;
        }
      } catch (dedupErr) {
        console.error('[WorkflowProcessor] Deduplication check failed:', dedupErr);
      }
    }

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        organization: {
          include: { plan: true }
        }
      }
    });

    if (!workspace) {
      console.error(`[WorkflowProcessor] Workspace "${workspaceId}" not found. Message ignored.`);
      return;
    }

    const orgId = workspace.orgId;
    const plan = workspace.organization.plan;

    // Auto-capture lead if it doesn't exist
    try {
      const existingLead = await prisma.lead.findFirst({
        where: { workspaceId, phone: contactId }
      });
      if (!existingLead) {
        let allowCapture = true;

        if (plan) {
          const currentLeadsCount = await prisma.lead.count({
            where: {
              workspace: {
                orgId: orgId
              }
            }
          });

          if (currentLeadsCount >= plan.maxLeads) {
            allowCapture = false;
            console.log(`[WorkflowProcessor] Lead capture limit reached (${plan.maxLeads}) for Org: ${orgId}. Lead not captured.`);
          }
        }

        if (allowCapture) {
          await prisma.lead.create({
            data: {
              workspaceId,
              name: `Lead ${contactId}`,
              phone: contactId,
              status: 'NEW',
              source: 'WEBHOOK'
            }
          });
          console.log(`[WorkflowProcessor] Auto-captured new lead for contact: ${contactId}`);
        }
      }
    } catch (leadErr) {
      console.error('[WorkflowProcessor] Failed to auto-capture lead:', leadErr);
    }

    // 1. Find all active workflows for this workspace
    const workflows = await prisma.workflow.findMany({
      where: {
        workspaceId,
        status: 'ACTIVE'
      }
    });

    for (const workflow of workflows) {
      try {
        const definition = JSON.parse(workflow.definition) as unknown as WorkflowDefinition;
        if (!definition || !definition.nodes) continue;

        // 2. Identify the Trigger node(s) (incomingMessage)
        const triggerNodes = definition.nodes.filter(n => n.type === 'incomingMessage');
        
        for (const trigger of triggerNodes) {
          const triggerData = trigger.data as TriggerNodeData;
          
          // Match keyword: "*" matches any, or case-insensitive matching
          const isMatch = triggerData.keyword === '*' || 
            messageText.toLowerCase().trim() === triggerData.keyword.toLowerCase().trim();

          if (isMatch) {
            console.log(`[WorkflowProcessor] Trigger matched on workflow "${workflow.name}" (${workflow.id})`);
            // Run the workflow starting from this trigger node
            await this.executeWorkflow(workflow.id, workspaceId, definition, trigger, contactId, messageText, externalMessageId);
          }
        }
      } catch (err: any) {
        console.error(`[WorkflowProcessor] Failed processing workflow ${workflow.id}:`, err);
      }
    }
  }

  /**
   * Execute a single workflow graph
   */
  private static async executeWorkflow(
    workflowId: string,
    workspaceId: string,
    definition: WorkflowDefinition,
    triggerNode: WorkflowNode,
    contactId: string,
    messageText: string,
    externalMessageId?: string
  ): Promise<void> {
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        organization: {
          include: { plan: true }
        }
      }
    });

    if (!workspace) return;
    const plan = workspace.organization.plan;

    // Check execution plan limits
    if (plan) {
      const currentExecutionsCount = await prisma.workflowExecution.count({
        where: {
          workspace: {
            orgId: workspace.orgId
          }
        }
      });

      if (currentExecutionsCount >= plan.maxExecutions) {
        console.log(`[WorkflowProcessor] Automation executions limit reached (${plan.maxExecutions}) for Org: ${workspace.orgId}. Running blocked.`);
        
        // Add audit log for limit breach
        await prisma.auditLog.create({
          data: {
            orgId: workspace.orgId,
            workspaceId,
            action: 'LIMIT_BREACHED',
            resource: 'WorkflowExecution',
            details: `Executions limit reached (${plan.maxExecutions}). Execution blocked.`
          }
        });
        return;
      }
    }

    const stepResults: StepResult[] = [];
    let currentNode: WorkflowNode | null = triggerNode;
    let executionStatus: 'SUCCESS' | 'FAILED' = 'SUCCESS';
    let stepsRun = 0;

    // Log trigger execution
    stepResults.push({
      nodeId: triggerNode.id,
      nodeType: triggerNode.type,
      status: 'SUCCESS',
      details: `Trigger matched: "${messageText}" against keyword "${(triggerNode.data as TriggerNodeData).keyword}"`,
      timestamp: new Date().toISOString()
    });

    // Create a initial db execution log to get an ID
    const execution = await prisma.workflowExecution.create({
      data: {
        workflowId,
        workspaceId,
        contactId,
        status: 'RUNNING',
        stepResults: JSON.stringify(stepResults),
        externalMessageId: externalMessageId || null
      }
    });

    try {
      // Find the initial edge(s) leading out from trigger node
      let nextEdge = definition.edges.find(e => e.source === currentNode?.id);
      
      while (nextEdge && stepsRun < MAX_STEPS) {
        stepsRun++;
        
        // Find target node
        const targetId = nextEdge.target;
        const targetNode = definition.nodes.find(n => n.id === targetId);

        if (!targetNode) {
          stepResults.push({
            nodeId: targetId,
            nodeType: 'incomingMessage', // placeholder
            status: 'FAILED',
            details: `Target node ${targetId} not found in workflow definition.`,
            timestamp: new Date().toISOString()
          });
          executionStatus = 'FAILED';
          break;
        }

        currentNode = targetNode;
        console.log(`[WorkflowProcessor] Executing Node [${currentNode.id}] of type "${currentNode.type}"`);

        if (currentNode.type === 'condition') {
          const conditionData = currentNode.data as ConditionNodeData;
          let evaluationResult = false;
          
          // Determine variable field to check
          const valToCheck = conditionData.field === 'contactId' ? contactId : messageText;

          // Perform operation
          const cleanInput = (valToCheck || '').toLowerCase().trim();
          const cleanTarget = (conditionData.value || '').toLowerCase().trim();

          switch (conditionData.operator) {
            case 'EQUALS':
              evaluationResult = cleanInput === cleanTarget;
              break;
            case 'CONTAINS':
              evaluationResult = cleanInput.includes(cleanTarget);
              break;
            case 'STARTS_WITH':
              evaluationResult = cleanInput.startsWith(cleanTarget);
              break;
            default:
              throw new Error(`Unsupported condition operator: ${conditionData.operator}`);
          }

          stepResults.push({
            nodeId: currentNode.id,
            nodeType: currentNode.type,
            status: 'SUCCESS',
            details: `Condition checked: "${conditionData.field}" (${valToCheck}) ${conditionData.operator} "${conditionData.value}". Result = ${evaluationResult}`,
            timestamp: new Date().toISOString()
          });

          // Branching edge search
          const handleToFollow = evaluationResult ? 'true' : 'false';
          nextEdge = definition.edges.find(e => e.source === currentNode?.id && e.sourceHandle === handleToFollow);
          
          if (!nextEdge) {
            stepResults.push({
              nodeId: currentNode.id,
              nodeType: currentNode.type,
              status: 'SUCCESS',
              details: `Execution path completed: No connected path for branch "${handleToFollow}"`,
              timestamp: new Date().toISOString()
            });
            break;
          }

        } else if (currentNode.type === 'sendWhatsapp') {
          const actionData = currentNode.data as ActionNodeData;
          
          // Send message
          const success = await whatsappService.sendMessage(workspace.orgId, contactId, actionData.message, workspaceId);
          
          if (success) {
            stepResults.push({
              nodeId: currentNode.id,
              nodeType: currentNode.type,
              status: 'SUCCESS',
              details: `Sent WhatsApp message: "${actionData.message}" to contact ${contactId}`,
              timestamp: new Date().toISOString()
            });
          } else {
            throw new Error(`Failed to send WhatsApp message`);
          }

          // Follow the standard exit edge
          nextEdge = definition.edges.find(e => e.source === currentNode?.id);

        } else {
          // Unknown or unsupported type
          throw new Error(`Unsupported node type: ${currentNode.type}`);
        }
      }

      if (stepsRun >= MAX_STEPS) {
        stepResults.push({
          nodeId: currentNode?.id || 'unknown',
          nodeType: currentNode?.type || 'incomingMessage',
          status: 'FAILED',
          details: `Loop limit reached: Exceeded maximum workflow depth of ${MAX_STEPS} nodes.`,
          timestamp: new Date().toISOString()
        });
        executionStatus = 'FAILED';
      }

    } catch (error: any) {
      console.error(`[WorkflowProcessor] Error during execution flow:`, error);
      executionStatus = 'FAILED';
      stepResults.push({
        nodeId: currentNode?.id || 'unknown',
        nodeType: currentNode?.type || 'incomingMessage',
        status: 'FAILED',
        details: `Error encountered: ${error.message || error}`,
        timestamp: new Date().toISOString()
      });
    }

    // Save final execution result back to the database
    try {
      await prisma.workflowExecution.update({
        where: { id: execution.id },
        data: {
          status: executionStatus,
          stepResults: JSON.stringify(stepResults)
        }
      });
    } catch (dbUpErr) {
      console.error('[WorkflowProcessor] Failed updating final execution status:', dbUpErr);
    }

    console.log(`[WorkflowProcessor] Workflow ${workflowId} finished executing. Status: ${executionStatus}`);
  }
}
