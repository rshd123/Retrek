import { useState, useEffect } from 'react';
import { api } from '../services/api';

export default function TransactionsPage({ seedVersion }) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    loadTransactions();
  }, [seedVersion]);

  const loadTransactions = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await api.getTransactions();
      setTransactions(res.data || []);
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to fetch transactions' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="tab-view">
      <div className="view-header">
        <div>
          <h2 className="view-title">All Transactions</h2>
          <p className="view-subtitle">Live status of processed, pending, and recovered transactions</p>
        </div>
        <button className="btn btn-outline" onClick={loadTransactions} style={{ border: '1px solid rgba(23,79,67,0.2)', color: 'var(--text)' }}>
          Refresh
        </button>
      </div>

      {message && (
        <div className={`dash-alert ${message.type === 'error' ? 'dash-alert-error' : 'dash-alert-success'}`}>
          <span>{message.text}</span>
        </div>
      )}

      {loading ? (
        <div className="empty-state">
          <div className="spinner" />
          <p>Loading transactions...</p>
        </div>
      ) : transactions.length === 0 ? (
        <div className="empty-state">
          <p>No transactions found. Seed test cases from the sidebar to populate data.</p>
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Customer</th>
                <th>Amount</th>
                <th>Method</th>
                <th>Status</th>
                <th>Created At</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr key={tx.id}>
                  <td className="code-cell">{tx.id.slice(0, 8)}...</td>
                  <td>{tx.customer_name || 'N/A'}</td>
                  <td className="font-bold">₹{Number(tx.amount).toLocaleString()}</td>
                  <td>{tx.payment_method || 'CARD'}</td>
                  <td>
                    <span className={`status-pill status-${(tx.status || 'unknown').toLowerCase()}`}>
                      {tx.status}
                    </span>
                  </td>
                  <td className="text-muted">{new Date(tx.created_at || Date.now()).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
