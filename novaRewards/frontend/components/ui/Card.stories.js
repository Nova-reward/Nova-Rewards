import Card from './Card';

export default { title: 'UI/Card', component: Card };

export const Default = () => <Card>Default card content</Card>;
export const Elevated = () => <Card variant="elevated">Elevated card content</Card>;
export const Bordered = () => <Card variant="bordered">Bordered card content</Card>;
