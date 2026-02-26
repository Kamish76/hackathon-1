'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface Gate {
  id: string;
  gate_code: string;
  gate_name: string;
}

const STORAGE_KEY = 'officer_selected_gate';

export function useOfficerGate() {
  const [gates, setGates] = useState<Gate[]>([]);
  // Lazy initializer reads localStorage synchronously — avoids setState-in-effect
  const [selectedGate, setSelectedGateState] = useState<Gate | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? (JSON.parse(stored) as Gate) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    // Fetch available gates
    const supabase = createClient();
    supabase
      .from('gates')
      .select('id, gate_code, gate_name')
      .eq('is_active', true)
      .order('gate_code')
      .then(({ data }: { data: Gate[] | null }) => { if (data) setGates(data); });
  }, []);

  const setSelectedGate = (gate: Gate | null) => {
    setSelectedGateState(gate);
    if (gate) localStorage.setItem(STORAGE_KEY, JSON.stringify(gate));
    else localStorage.removeItem(STORAGE_KEY);
  };

  return { gates, selectedGate, setSelectedGate };
}
