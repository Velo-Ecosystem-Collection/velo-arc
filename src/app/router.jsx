import { createHashRouter } from 'react-router-dom';
import Layout from '../components/Layout';
import React from 'react';
import { ContractProvider } from '../context/ContractContext';
import { DeployProvider } from '../context/DeployContext';
import { FullstackProvider } from '../context/FullstackContext';
import ArcEventGate from '../components/ArcEventGate';

const WrappedLayout = () => (
  <ArcEventGate>
    <ContractProvider>
      <DeployProvider>
        <FullstackProvider>
          <Layout />
        </FullstackProvider>
      </DeployProvider>
    </ContractProvider>
  </ArcEventGate>
);

const router = createHashRouter([
  {
    path: '/',
    element: <WrappedLayout />,
    errorElement: <WrappedLayout />,
  },
]);

export default router;
