import EmptyState from '../components/EmptyState';

export default {
  title: 'Components/EmptyState',
  component: EmptyState,
  parameters: {
    layout: 'centered',
  },
};

const Template = (args) => <EmptyState {...args} />;

export const Default = Template.bind({});
Default.args = {
  icon: 'inbox',
  title: 'Nothing here yet',
  description: 'Get started by taking an action below.',
};

export const WithAction = Template.bind({});
WithAction.args = {
  icon: 'rewards',
  title: 'No rewards yet',
  description: 'Start earning rewards by completing campaigns.',
  actionLabel: 'Browse Campaigns',
  onAction: () => alert('Action clicked!'),
};

export const Campaigns = Template.bind({});
Campaigns.args = {
  icon: 'campaigns',
  title: 'No campaigns yet',
  description: 'Create your first reward campaign to get started issuing tokens to your users.',
  actionLabel: 'Create Campaign',
  onAction: () => alert('Create campaign clicked!'),
  variant: 'primary',
};

export const Transactions = Template.bind({});
Transactions.args = {
  icon: 'transactions',
  title: 'No transactions',
  description: 'Your transaction history will appear here.',
  variant: 'default',
};

export const Notifications = Template.bind({});
Notifications.args = {
  icon: 'notifications',
  title: 'All caught up',
  description: 'You have no notifications right now.',
  variant: 'success',
};

export const Search = Template.bind({});
Search.args = {
  icon: 'search',
  title: 'No results found',
  description: 'Try adjusting your search terms.',
  variant: 'warning',
};

export const AllVariants = () => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '2rem', padding: '2rem' }}>
    <div>
      <h3 style={{ marginBottom: '1rem', fontSize: '0.875rem', fontWeight: 600, textTransform: 'uppercase', color: '#666' }}>Default</h3>
      <EmptyState
        icon="inbox"
        title="Nothing here yet"
        description="Get started by taking an action below."
        variant="default"
      />
    </div>
    <div>
      <h3 style={{ marginBottom: '1rem', fontSize: '0.875rem', fontWeight: 600, textTransform: 'uppercase', color: '#666' }}>Primary</h3>
      <EmptyState
        icon="campaigns"
        title="No campaigns yet"
        description="Create your first reward campaign."
        actionLabel="Create Campaign"
        variant="primary"
      />
    </div>
    <div>
      <h3 style={{ marginBottom: '1rem', fontSize: '0.875rem', fontWeight: 600, textTransform: 'uppercase', color: '#666' }}>Success</h3>
      <EmptyState
        icon="notifications"
        title="All caught up"
        description="You have no notifications right now."
        variant="success"
      />
    </div>
    <div>
      <h3 style={{ marginBottom: '1rem', fontSize: '0.875rem', fontWeight: 600, textTransform: 'uppercase', color: '#666' }}>Warning</h3>
      <EmptyState
        icon="search"
        title="No results found"
        description="Try adjusting your search terms."
        variant="warning"
      />
    </div>
  </div>
);
