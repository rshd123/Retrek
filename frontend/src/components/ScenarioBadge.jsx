const SCENARIO_CONFIG = {
  payment_degradation: {
    label: 'Payment Degradation',
    color: '#1e40af',
    bg: '#eff6ff',
    border: '#bfdbfe',
  },
  checkout_dropoff: {
    label: 'Checkout Drop-off',
    color: '#9a3412',
    bg: '#fff7ed',
    border: '#fed7aa',
  },
  subscription_failure: {
    label: 'Subscription Failure',
    color: '#6b21a8',
    bg: '#faf5ff',
    border: '#d8b4fe',
  },
  b2b_receivables: {
    label: 'B2B Receivables',
    color: '#115e59',
    bg: '#f0fdfa',
    border: '#99f6e4',
  },
  mandate_retry: {
    label: 'Mandate Retry',
    color: '#3730a3',
    bg: '#eef2ff',
    border: '#c7d2fe',
  },
  voice_recovery: {
    label: 'Voice Recovery',
    color: '#9d174d',
    bg: '#fdf2f8',
    border: '#fbcfe8',
  },
  ptp_commitment: {
    label: 'Promise-to-Pay',
    color: '#92400e',
    bg: '#fffbeb',
    border: '#fde68a',
  },
};

const DEFAULT_CONFIG = {
  label: 'Unknown',
  color: '#64748b',
  bg: '#f1f5f9',
  border: '#e2e8f0',
};

export default function ScenarioBadge({ scenarioType, compact = false }) {
  const config = SCENARIO_CONFIG[scenarioType] || DEFAULT_CONFIG;

  const style = {
    display: 'inline-flex',
    alignItems: 'center',
    padding: compact ? '2px 8px' : '4px 10px',
    borderRadius: '6px',
    fontSize: compact ? '10px' : '12px',
    fontWeight: 600,
    color: config.color,
    background: config.bg,
    border: `1px solid ${config.border}`,
    whiteSpace: 'nowrap',
    lineHeight: 1.3,
  };

  return (
    <span style={style} title={config.label}>
      {config.label}
    </span>
  );
}

export { SCENARIO_CONFIG };
