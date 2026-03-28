"use client";

import { useState, useEffect, useCallback } from "react";

interface User {
  id: number;
  email: string;
}

const STORAGE_KEY = "voisli_user";
const SETUP_KEY = "voisli_setup_completed";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [setupCompleted, setSetupCompleted] = useState(true);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setUser(JSON.parse(stored));
    } catch {
      // Corrupt data — clear it
      localStorage.removeItem(STORAGE_KEY);
    }
    setSetupCompleted(localStorage.getItem(SETUP_KEY) === "true");
    setLoading(false);
  }, []);

  const login = useCallback((userData: User) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
    setUser(userData);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
  }, []);

  const completeSetup = useCallback(() => {
    localStorage.setItem(SETUP_KEY, "true");
    setSetupCompleted(true);
  }, []);

  return {
    user,
    isAuthenticated: !!user,
    setupCompleted,
    loading,
    login,
    logout,
    completeSetup,
  };
}
