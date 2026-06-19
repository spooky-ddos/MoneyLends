import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { AuthContext } from './AuthContext';

export const UserProfileContext = createContext();

// Kontekst profilu użytkownika - czyta dokument users/{uid}.
// Trzymamy tu m.in. flagę isAdmin oraz listę widzianych wpisów changelogu.
export function UserProfileProvider({ children }) {
  const { user } = useContext(AuthContext);
  const [profile, setProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const loadProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setLoadingProfile(false);
      return;
    }
    setLoadingProfile(true);
    try {
      const ref = doc(db, 'users', user.uid);
      const snap = await getDoc(ref);
      setProfile(snap.exists() ? snap.data() : {});
    } catch (error) {
      console.error('Błąd podczas pobierania profilu użytkownika:', error);
      setProfile({});
    } finally {
      setLoadingProfile(false);
    }
  }, [user]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const isAdmin = !!(profile && profile.isAdmin);

  return (
    <UserProfileContext.Provider value={{ profile, isAdmin, loadingProfile, refreshProfile: loadProfile }}>
      {children}
    </UserProfileContext.Provider>
  );
}

export const useUserProfile = () => useContext(UserProfileContext);
