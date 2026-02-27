// src/components/TestDebug.tsx
import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function TestDebug() {
  useEffect(() => {
    async function test() {
      console.log('=== TEST SUPABASE ===');
      
      // Test 1: Employees
      const { data: emp, error: empErr } = await supabase
        .from('employees')
        .select('*');
      console.log('Employees:', emp?.length, empErr);
      
      // Test 2: TRFs
      const { data: trf, error: trfErr } = await supabase
        .from('trfs')
        .select('*');
      console.log('TRFs:', trf?.length, trfErr);
      
      // Test 3: Users
      const { data: usr, error: usrErr } = await supabase
        .from('users')
        .select('*');
      console.log('Users:', usr?.length, usrErr);
    }
    
    test();
  }, []);
  // Tambahkan ini di TestDebug.tsx untuk test langsung
useEffect(() => {
  async function testRaw() {
    // Test dengan fetch API langsung
    const response = await fetch(
      'https://jntywyhmcfbnyhcdxzce.supabase.co/rest/v1/employees?select=*',
      {
        headers: {
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpudHl3eWhtY2ZibnloY2R4emNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwMDIwMjgsImV4cCI6MjA4NzU3ODAyOH0.Btdq7qzlS8Z8tGlsO42Fzj1qD1Ll9WDW1FrrSe8Whpw',
          'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpudHl3eWhtY2ZibnloY2R4emNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwMDIwMjgsImV4cCI6MjA4NzU3ODAyOH0.Btdq7qzlS8Z8tGlsO42Fzj1qD1Ll9WDW1FrrSe8Whpw'
        }
      }
    );
    const data = await response.json();
    console.log('RAW FETCH:', data);
  }
  
  testRaw();
}, []);

  return (
    <div className="p-4">
      <h1>Check Console (F12)</h1>
      <p>Lihat hasil di tab Console</p>
    </div>
  );
}