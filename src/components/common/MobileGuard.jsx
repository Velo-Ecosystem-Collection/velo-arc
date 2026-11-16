import React from 'react';
import '../../styles/mobile-guard.css';

const MobileGuard = ({ children }) => {
  return (
    <>
      <div className="mobile-guard-overlay">
        <div className="mobile-guard-container">
          <img 
            src="/assets/images/velo-arc-logo-dark.png"
            alt="Velo Arc logo"
            className="mobile-guard-icon"
          />
          <h1 className="mobile-guard-title">Please Switch to Desktop</h1>
          <p className="mobile-guard-text">
            Velo Arc is designed for a professional coding experience.
            To access the editor and compiler, please use a desktop computer or a laptop.
          </p>
        </div>
      </div>
      {children}
    </>
  );
};

export default MobileGuard;
