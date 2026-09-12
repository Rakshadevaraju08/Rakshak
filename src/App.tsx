/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { AppScreen } from './types';
import { Header } from './components/Header';
import { MobileEmergencyPortal } from './components/MobileEmergencyPortal';
import { OperatorCommand } from './components/OperatorCommand';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<AppScreen>('citizen-portal');
  const [isOffline, setIsOffline] = useState<boolean>(false);
  const [unreadAlerts, setUnreadAlerts] = useState<number>(3);

  const handleDistressDispatched = (details: { category: string; people: number; note: string }) => {
    setUnreadAlerts((prev) => prev + 1);
    console.log('Emergency dispatch queued from Citizen SOS:', details);
  };

  return (
    <div className="min-h-screen bg-[#0d1320] text-[#dde2f5] flex flex-col font-sans selection:bg-[#ff5451] selection:text-white">
      {/* Top Header & Screen Navigation */}
      <Header
        currentScreen={currentScreen}
        onSelectScreen={setCurrentScreen}
        unreadAlertsCount={unreadAlerts}
      />

      {/* Screen Views */}
      <main className="w-full flex-grow">
        {currentScreen === 'citizen-portal' ? (
          <MobileEmergencyPortal
            isOffline={isOffline}
            onToggleOffline={setIsOffline}
            onDistressDispatched={handleDistressDispatched}
          />
        ) : (
          <OperatorCommand
            onSimulateCitizenSos={() => setUnreadAlerts((prev) => prev + 1)}
          />
        )}
      </main>
    </div>
  );
}
