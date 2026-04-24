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
      <CardTitle>Confirm Action</CardTitle>
    </CardHeader>
    <CardContent>
      <p className="text-sm text-gray-600">Are you sure you want to proceed?</p>
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
);
