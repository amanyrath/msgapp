import React, { createContext, useState, useEffect, useContext } from 'react';
import { subscribeToMultiplePresence } from '../utils/presence';

const PresenceContext = createContext({});

export const PresenceProvider = ({ children, userIds = [] }) => {
  const [presenceData, setPresenceData] = useState({});

  useEffect(() => {
    if (!userIds || userIds.length === 0) {
      return;
    }

    console.log('Subscribing to presence for:', userIds.length, 'users');
    
    const unsubscribe = subscribeToMultiplePresence(userIds, (data) => {
      setPresenceData(data);
    });

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [JSON.stringify(userIds)]);

  const value = {
    presenceData,
    getUserPresence: (userId) => presenceData[userId] || null,
  };

  return (
    <PresenceContext.Provider value={value}>
      {children}
    </PresenceContext.Provider>
  );
};

export const usePresence = () => {
  const context = useContext(PresenceContext);
  if (!context) {
    throw new Error('usePresence must be used within a PresenceProvider');
  }
  return context;
};

export default PresenceContext;

