'use client';
import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import CustomerTable from '@/components/CustomerTable';
import PageHeader from '@/components/PageHeader';
import StatePanel from '@/components/StatePanel';
import { api, type Customer } from '@/lib/api';
import Link from 'next/link';

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.customers(undefined, undefined, 60);
      setCustomers(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load customer register');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const initialLoad = async () => {
      try {
        const data = await api.customers(undefined, undefined, 60);
        if (!cancelled) {
          setCustomers(data);
          setError('');
        }
      } catch (err: unknown) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load customer register');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void initialLoad();
    return () => {
      cancelled = true;
    };
  }, []);

  const atRiskCount = customers.filter((customer) => customer.subscription_status === 'at_risk').length;

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="app-shell-main">
        <PageHeader
          eyebrow="Customer Intelligence"
          title="Customer"
          highlight="Risk Register"
          description="A ranked operating register of every tracked account, including renewal confidence, revenue exposure, and the latest churn signals."
          aside={
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#6f82ac]">At-risk today</p>
              <p className="mt-1 text-sm font-semibold text-[#f0f4ff]">{loading ? '...' : atRiskCount}</p>
            </div>
          }
          actions={
            <>
              <button onClick={() => void load()} className="btn-ghost">
                Refresh customers
              </button>
              <Link href="/ask" className="btn-primary">
                Analyze a segment
              </Link>
            </>
          }
        />

        {error ? (
          <StatePanel
            tone="error"
            title="Customer register could not be loaded"
            body={error}
            actions={
              <button onClick={() => void load()} className="btn-primary">
                Retry customer load
              </button>
            }
          />
        ) : (
          <div className="min-w-0">
            <CustomerTable customers={customers} loading={loading} />
          </div>
        )}
      </main>
    </div>
  );
}
