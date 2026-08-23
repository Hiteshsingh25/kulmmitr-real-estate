import React, { useState } from 'react';
import { Lock, Eye, EyeOff, ShieldAlert } from 'lucide-react';

interface LockScreenProps {
  onSubmit: (password: string) => void;
  errorMsg: string | null;
  orgName: string;
}

export const LockScreen: React.FC<LockScreenProps> = ({ onSubmit, errorMsg, orgName }) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    onSubmit(password);
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: 'rgba(5, 6, 11, 0.85)',
      backdropFilter: 'blur(20px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 999,
      animation: 'fadeIn 0.3s ease'
    }}>
      <div style={{
        background: 'rgba(22, 28, 45, 0.65)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5), 0 0 20px rgba(139, 92, 246, 0.1)',
        borderRadius: '16px',
        padding: '40px',
        width: '100%',
        maxWidth: '400px',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '20px'
      }}>
        {/* Animated padlock icon */}
        <div style={{
          background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)',
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 0 20px rgba(139, 92, 246, 0.4)',
          color: 'white',
          marginBottom: '8px'
        }}>
          <Lock size={28} />
        </div>

        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'white', marginBottom: '8px' }}>
            Protected Workspace
          </h2>
          <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
            Unlock **{orgName}** to continue
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ position: 'relative', width: '100%' }}>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter workspace security password"
              style={{
                width: '100%',
                background: 'rgba(0, 0, 0, 0.4)',
                border: errorMsg ? '1px solid #ef4444' : '1px solid rgba(255, 255, 255, 0.1)',
                padding: '12px 42px 12px 14px',
                borderRadius: '8px',
                color: 'white',
                outline: 'none',
                fontSize: '0.9rem',
                transition: 'border-color 0.2s'
              }}
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: 'absolute',
                right: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {errorMsg && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: '#ef4444',
              fontSize: '0.8rem',
              textAlign: 'left',
              background: 'rgba(239, 68, 68, 0.1)',
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid rgba(239, 68, 68, 0.15)'
            }}>
              <ShieldAlert size={16} style={{ flexShrink: 0 }} />
              <span>{errorMsg}</span>
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            style={{
              width: '100%',
              padding: '12px',
              justifyContent: 'center',
              fontSize: '0.95rem',
              fontWeight: 600
            }}
          >
            Unlock Workspace
          </button>
        </form>
      </div>
    </div>
  );
};
