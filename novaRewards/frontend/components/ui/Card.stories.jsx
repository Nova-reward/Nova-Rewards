import React from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from './Card';
import { Button } from './Button';

export default {
  title: 'UI/Card',
  component: Card,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: ['default', 'interactive', 'highlighted'],
    },
  },
};

export const Default = () => (
  <Card className="w-80">
    <CardHeader>
      <CardTitle>Card Title</CardTitle>
    </CardHeader>
    <CardContent>
      <p className="type-body-sm text-neutral-600 dark:text-neutral-400">Card content goes here.</p>
    </CardContent>
  </Card>
);

export const Interactive = () => (
  <Card variant="interactive" className="w-80">
    <CardHeader>
      <CardTitle>Interactive Card</CardTitle>
    </CardHeader>
    <CardContent>
      <p className="type-body-sm text-neutral-600 dark:text-neutral-400">
        Hover or focus to see the interactive state.
      </p>
    </CardContent>
  </Card>
);

export const Highlighted = () => (
  <Card variant="highlighted" className="w-80">
    <CardHeader>
      <CardTitle>Highlighted Card</CardTitle>
    </CardHeader>
    <CardContent>
      <p className="type-body-sm text-neutral-600 dark:text-neutral-400">
        Used for featured or priority content.
      </p>
    </CardContent>
  </Card>
);

export const WithFooter = () => (
  <Card className="w-80">
    <CardHeader>
      <CardTitle>Confirm Action</CardTitle>
    </CardHeader>
    <CardContent>
      <p className="type-body-sm text-neutral-600 dark:text-neutral-400">
        Are you sure you want to proceed?
      </p>
    </CardContent>
    <CardFooter className="gap-2">
      <Button variant="primary" size="sm">Confirm</Button>
      <Button variant="outline" size="sm">Cancel</Button>
    </CardFooter>
  </Card>
);

export const ContentOnly = () => (
  <Card className="w-80">
    <CardContent className="pt-6">
      <p className="type-body-sm text-neutral-600 dark:text-neutral-400">
        Card with content only — no header or footer.
      </p>
    </CardContent>
  </Card>
);

export const Loading = () => (
  <Card className="w-80">
    <CardHeader>
      <div className="h-5 w-32 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" aria-hidden="true" />
    </CardHeader>
    <CardContent>
      <div className="space-y-2">
        <div className="h-4 w-full animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" aria-hidden="true" />
        <div className="h-4 w-3/4 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" aria-hidden="true" />
      </div>
    </CardContent>
  </Card>
);
Loading.storyName = 'Loading (skeleton)';

export const AllVariants = () => (
  <div className="flex flex-wrap gap-4">
    {['default', 'interactive', 'highlighted'].map((v) => (
      <Card key={v} variant={v} className="w-52">
        <CardContent className="pt-6 pb-6">
          <p className="type-label text-neutral-900 dark:text-neutral-100 capitalize">{v}</p>
        </CardContent>
      </Card>
    ))}
  </div>
);
