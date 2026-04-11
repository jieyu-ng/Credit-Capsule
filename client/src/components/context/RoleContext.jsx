import React, { createContext, useState, useContext } from 'react';

const RoleContext = createContext();

export const useRole = () => {
  const context = useContext(RoleContext);
  if (!context) {
    throw new Error('useRole must be used within RoleProvider');
  }
  return context;
};

export const RoleProvider = ({ children }) => {
  const [userRole, setUserRole] = useState(() => {
    // Check localStorage for saved role preference
    return localStorage.getItem('userRole') || 'user';
  });

  const switchRole = (role) => {
    setUserRole(role);
    localStorage.setItem('userRole', role);
  };

  return (
    <RoleContext.Provider value={{ userRole, switchRole }}>
      {children}
    </RoleContext.Provider>
  );
};