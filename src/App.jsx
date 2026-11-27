import React from 'react';
import { RouterProvider } from 'react-router-dom';
import router from './app/router';
import MobileGuard from './components/common/MobileGuard';
import { TooltipProvider } from '@/components/ui/tooltip';
import './styles/arc-event.css';

const App = () => (
  <React.StrictMode>
    <MobileGuard>
      <TooltipProvider>
        <RouterProvider router={router} />
      </TooltipProvider>
    </MobileGuard>
  </React.StrictMode>
);

export default App;
