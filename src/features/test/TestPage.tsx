// components/TestPage.tsx
import { useEffect, useState } from 'react';
import { getEmployees, getTRFs, getUsers } from '@/store/supabaseStore';
import { supabase, isSupabaseEnabled } from '@/lib/supabase';

export default function TestPage() {
  const [results, setResults] = useState<any>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function runTests() {
      const testResults: any = {
        supabaseEnabled: isSupabaseEnabled(),
        timestamp: new Date().toISOString(),
        tests: []
      };

      try {
        // Test 1: Connection
        testResults.tests.push({
          name: 'Supabase Connection',
          status: isSupabaseEnabled() ? 'PASS' : 'FAIL',
          detail: isSupabaseEnabled() ? 'Connected' : 'Using mock mode'
        });

        // Test 2: Fetch Employees
        try {
          const employees = await getEmployees();
          testResults.tests.push({
            name: 'Fetch Employees',
            status: 'PASS',
            count: employees.length,
            sample: employees[0] ? {
              id: employees[0].id,
              name: employees[0].employeeName,
              userId: employees[0].userId, // Cek ini!
              type: employees[0].employeeType
            } : null
          });
        } catch (e) {
          testResults.tests.push({
            name: 'Fetch Employees',
            status: 'FAIL',
            error: (e as Error).message
          });
        }

        // Test 3: Fetch TRFs
        try {
          const trfs = await getTRFs();
          testResults.tests.push({
            name: 'Fetch TRFs',
            status: 'PASS',
            count: trfs.length,
            sample: trfs[0] ? {
              id: trfs[0].id,
              trfNumber: trfs[0].trfNumber,
              status: trfs[0].status,
              employeeName: trfs[0].employee?.employeeName
            } : null
          });
        } catch (e) {
          testResults.tests.push({
            name: 'Fetch TRFs',
            status: 'FAIL',
            error: (e as Error).message
          });
        }

        // Test 4: Direct Supabase Query
        try {
          const { data, error } = await supabase
            .from('employees')
            .select('id, employee_name, user_id')
            .limit(1);
            
          if (error) throw error;
          
          testResults.tests.push({
            name: 'Direct Supabase Query',
            status: 'PASS',
            data: data
          });
        } catch (e) {
          testResults.tests.push({
            name: 'Direct Supabase Query',
            status: 'FAIL',
            error: (e as Error).message
          });
        }

      } catch (error) {
        testResults.fatalError = (error as Error).message;
      }

      setResults(testResults);
      setLoading(false);
    }

    runTests();
  }, []);

  if (loading) return <div className="p-4">Running tests...</div>;

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold">TRF System Test Results</h1>
      
      <div className="bg-gray-100 p-4 rounded">
        <p><strong>Supabase Enabled:</strong> {results.supabaseEnabled ? '✅ Yes' : '❌ No (Mock Mode)'}</p>
        <p><strong>Timestamp:</strong> {results.timestamp}</p>
      </div>

      <div className="space-y-2">
        {results.tests?.map((test: any, idx: number) => (
          <div 
            key={idx} 
            className={`p-4 rounded border ${
              test.status === 'PASS' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-xl">
                {test.status === 'PASS' ? '✅' : '❌'}
              </span>
              <strong>{test.name}</strong>
              <span className={`text-sm px-2 py-1 rounded ${
                test.status === 'PASS' ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'
              }`}>
                {test.status}
              </span>
            </div>
            
            {test.count !== undefined && (
              <p className="text-sm text-gray-600 mt-1">Count: {test.count}</p>
            )}
            
            {test.sample && (
              <pre className="text-xs bg-gray-800 text-green-400 p-2 rounded mt-2 overflow-auto">
                {JSON.stringify(test.sample, null, 2)}
              </pre>
            )}
            
            {test.error && (
              <p className="text-sm text-red-600 mt-1">Error: {test.error}</p>
            )}
            
            {test.data && (
              <pre className="text-xs bg-gray-800 text-blue-400 p-2 rounded mt-2 overflow-auto">
                {JSON.stringify(test.data, null, 2)}
              </pre>
            )}
          </div>
        ))}
      </div>

      {results.fatalError && (
        <div className="bg-red-100 border border-red-400 text-red-700 p-4 rounded">
          <strong>Fatal Error:</strong> {results.fatalError}
        </div>
      )}

      <details className="mt-4">
        <summary className="cursor-pointer text-blue-600">Raw Results (JSON)</summary>
        <pre className="text-xs bg-gray-900 text-gray-100 p-4 rounded mt-2 overflow-auto max-h-96">
          {JSON.stringify(results, null, 2)}
        </pre>
      </details>
    </div>
  );
}