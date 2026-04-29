 feat/storybook-components-setup
import React from 'react';
import Card from './Card';
import Button from './Button';

import { Card, CardHeader, CardTitle, CardContent, CardFooter } from './Card';
import { Button } from './Button';
 main

export default {
  title: 'UI/Card',
  component: Card,
  tags: ['autodocs'],
 feat/storybook-components-setup
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: ['default', 'elevated', 'bordered'],
    },
  },
};

const Template = (args) => (
  <Card {...args} style={{ width: '320px', padding: '24px' }}>
    <h3 style={{ marginBottom: '8px', fontWeight: 600 }}>Card Title</h3>
    <p style={{ fontSize: '14px', color: '#64748b' }}>Card body content goes here.</p>
  </Card>
);

export const Default = Template.bind({});
Default.args = { variant: 'default' };

export const Elevated = Template.bind({});
Elevated.args = { variant: 'elevated' };

export const Bordered = Template.bind({});
Bordered.args = { variant: 'bordered' };

export const WithActions = () => (
  <Card style={{ width: '320px', padding: '24px' }}>
    <h3 style={{ marginBottom: '8px', fontWeight: 600 }}>Confirm Action</h3>
    <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '16px' }}>
      Are you sure you want to proceed?
    </p>
    <div style={{ display: 'flex', gap: '8px' }}>
      <Button variant="primary" size="sm">Confirm</Button>
      <Button variant="secondary" size="sm">Cancel</Button>
    </div>

};

export const Default = () => (
  <Card className="w-80">
    <CardHeader>
      <CardTitle>Card Title</CardTitle>
    </CardHeader>
    <CardContent>
      <p className="text-sm text-gray-600">Card content goes here.</p>
    </CardContent>
  </Card>
);

export const WithFooter = () => (
  <Card className="w-80">
    <CardHeader>
      <CardTitle>Confirm Action</CardTitle>
    </CardHeader>
    <CardContent>
      <p className="text-sm text-gray-600">Are you sure you want to proceed?</p>
    </CardContent>
    <CardFooter className="gap-2">
      <Button variant="primary" size="sm">Confirm</Button>
      <Button variant="outline" size="sm">Cancel</Button>
    </CardFooter>
 main
  </Card>
);

export const ContentOnly = () => (
 feat/storybook-components-setup
  <Card style={{ width: '320px', padding: '24px' }}>
    <p style={{ fontSize: '14px', color: '#64748b' }}>Card with content only, no title.</p>
  </Card>
);

export const AllVariants = () => (
  <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
    {['default', 'elevated', 'bordered'].map((v) => (
      <Card key={v} variant={v} style={{ width: '200px', padding: '16px' }}>
        <p style={{ fontWeight: 600, textTransform: 'capitalize' }}>{v}</p>
      </Card>
    ))}
  </div>

  <Card className="w-80">
    <CardContent className="pt-6">
      <p className="text-sm text-gray-600">Card with content only — no header or footer.</p>
    </CardContent>
  </Card>
);

export const Loading = () => (
  <Card className="w-80">
    <CardHeader>
      <div className="h-5 w-32 animate-pulse rounded bg-gray-200" aria-hidden="true" />
    </CardHeader>
    <CardContent>
      <div className="space-y-2">
        <div className="h-4 w-full animate-pulse rounded bg-gray-200" aria-hidden="true" />
        <div className="h-4 w-3/4 animate-pulse rounded bg-gray-200" aria-hidden="true" />
      </div>
    </CardContent>
  </Card>
);
Loading.storyName = 'Loading (skeleton)';

export const CustomClassName = () => (
  <Card className="w-80 bg-gray-50 border-dashed">
    <CardHeader>
      <CardTitle>Custom Styled</CardTitle>
    </CardHeader>
    <CardContent>
      <p className="text-sm text-gray-600">Custom className applied.</p>
    </CardContent>
  </Card>
 main
);
