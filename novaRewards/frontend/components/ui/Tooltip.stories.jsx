import React from 'react';
import { Tooltip } from './Tooltip';
import { InformationCircleIcon, LockClosedIcon, StarIcon } from '@heroicons/react/24/outline';

export default {
  title: 'UI/Tooltip',
  component: Tooltip,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    position: {
      control: 'select',
      options: ['top', 'bottom', 'left', 'right'],
    },
    delay: { control: 'number' },
    disabled: { control: 'boolean' },
  },
};

const Template = (args) => (
  <div className="p-16">
    <Tooltip {...args}>
      <button className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 focus:ring-2 focus:ring-primary-600 focus:ring-offset-2 focus:outline-none">
        Hover me
      </button>
    </Tooltip>
  </div>
);

export const Default = Template.bind({});
Default.args = {
  content: 'This is a helpful tooltip',
  position: 'top',
};

export const PositionTop = Template.bind({});
PositionTop.args = {
  content: 'Tooltip appears above',
  position: 'top',
};

export const PositionBottom = Template.bind({});
PositionBottom.args = {
  content: 'Tooltip appears below',
  position: 'bottom',
};

export const PositionLeft = Template.bind({});
PositionLeft.args = {
  content: 'Tooltip appears to the left',
  position: 'left',
};

export const PositionRight = Template.bind({});
PositionRight.args = {
  content: 'Tooltip appears to the right',
  position: 'right',
};

export const LongContent = Template.bind({});
LongContent.args = {
  content: 'This tooltip has a longer description that wraps across multiple lines to show how the max-width constraint works.',
  position: 'top',
};

export const WithIconTrigger = () => (
  <div className="p-16 flex items-center gap-4">
    <span className="text-neutral-700 text-sm">Staking APY</span>
    <Tooltip content="Annual percentage yield earned by staking NOVA tokens. Calculated based on current pool size and emission rate." position="right">
      <button
        aria-label="Learn about staking APY"
        className="p-1 rounded-full hover:bg-neutral-100 focus:ring-2 focus:ring-primary-600 focus:outline-none"
      >
        <InformationCircleIcon className="w-4 h-4 text-neutral-400" aria-hidden="true" />
      </button>
    </Tooltip>
  </div>
);

export const WithLockIcon = () => (
  <div className="p-16">
    <Tooltip content="Tokens are locked for 30 days after staking" position="top">
      <button
        aria-label="Staking lock period information"
        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-neutral-200 text-neutral-600 text-sm hover:bg-neutral-50"
      >
        <LockClosedIcon className="w-4 h-4" aria-hidden="true" />
        Locked
      </button>
    </Tooltip>
  </div>
);

export const Disabled = Template.bind({});
Disabled.args = {
  content: 'This tooltip will not show',
  position: 'top',
  disabled: true,
};

export const AllPositions = () => (
  <div className="p-24 grid grid-cols-3 gap-16 place-items-center">
    <div /> {/* empty cell */}
    <Tooltip content="Top tooltip" position="top">
      <button className="px-3 py-2 bg-neutral-100 rounded-lg text-sm text-neutral-700">Top</button>
    </Tooltip>
    <div />

    <Tooltip content="Left tooltip" position="left">
      <button className="px-3 py-2 bg-neutral-100 rounded-lg text-sm text-neutral-700">Left</button>
    </Tooltip>
    <div className="w-12 h-12 rounded-full bg-primary-100 border-2 border-primary-600" />
    <Tooltip content="Right tooltip" position="right">
      <button className="px-3 py-2 bg-neutral-100 rounded-lg text-sm text-neutral-700">Right</button>
    </Tooltip>

    <div />
    <Tooltip content="Bottom tooltip" position="bottom">
      <button className="px-3 py-2 bg-neutral-100 rounded-lg text-sm text-neutral-700">Bottom</button>
    </Tooltip>
    <div />
  </div>
);

export const WithStarIcon = () => (
  <div className="p-16">
    <Tooltip content="NOVA Token — the native loyalty currency of Nova Rewards" position="bottom">
      <button
        aria-label="NOVA token information"
        className="p-2 rounded-full hover:bg-primary-50 focus:ring-2 focus:ring-primary-600 focus:outline-none"
      >
        <StarIcon className="w-6 h-6 text-primary-600" aria-hidden="true" />
      </button>
    </Tooltip>
  </div>
);
