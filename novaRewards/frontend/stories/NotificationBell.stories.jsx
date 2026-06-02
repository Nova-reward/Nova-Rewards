import NotificationBell from '../components/NotificationBell';

export default {
  title: 'Components/NotificationBell',
  component: NotificationBell,
  parameters: {
    layout: 'centered',
  },
};

const Template = (args) => <NotificationBell {...args} />;

export const Default = Template.bind({});
Default.args = {};

export const WithUnreadCount = () => (
  <div style={{ padding: '2rem', background: '#f5f5f5' }}>
    <p style={{ marginBottom: '1rem', fontSize: '0.875rem', color: '#666' }}>
      NotificationBell with unread notifications (requires NotificationProvider context)
    </p>
    <NotificationBell />
  </div>
);

export const InHeader = () => (
  <header style={{
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '1rem 2rem',
    background: 'white',
    borderBottom: '1px solid #e5e7eb',
    borderRadius: '8px',
  }}>
    <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>NovaRewards</div>
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
      <NotificationBell />
      <div style={{
        width: '32px',
        height: '32px',
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
      }} />
    </div>
  </header>
);
