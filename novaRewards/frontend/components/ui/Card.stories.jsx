import React from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from './Card';
import { Button } from './Button';

export default {
  title: 'UI/Card',
  component: Card,
  tags: ['autodocs'],
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
      <CardTitle>Card with Footer</CardTitle>
    </CardHeader>
    <CardContent>
      <p className="text-sm text-gray-600">Some content inside the card.</p>
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
      <p className="text-sm text-gray-600">Card with content only, no header or footer.</p>
    </CardContent>
  </Card>
);

export const CustomClassName = () => (
  <Card className="w-80 bg-gray-50 border-dashed">
    <CardHeader>
      <CardTitle>Custom Styled Card</CardTitle>
    </CardHeader>
    <CardContent>
      <p className="text-sm text-gray-600">Custom className applied to the card.</p>
    </CardContent>
  </Card>
);
