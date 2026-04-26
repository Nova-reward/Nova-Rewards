# Transactional Email Templates

This directory contains responsive HTML email templates for Nova Rewards transactional communications.

## Templates

- `base.html`: Base template with responsive styling and accessibility features
- `welcome.html`: Welcome email for new users
- `transaction-confirmation.html`: Confirmation email for completed transactions

## Design Principles

### Responsive Design
- All templates use table-based layouts for maximum email client compatibility
- Media queries for mobile optimization
- Fluid widths with max-width constraints

### Accessibility
- Semantic HTML with proper roles
- Alt text for images
- Screen reader friendly content
- High contrast colors
- Keyboard navigation support

### Cross-Client Compatibility
- Tested across major email clients:
  - Gmail (web and mobile)
  - Outlook (desktop and web)
  - Apple Mail
  - Yahoo Mail
  - Thunderbird
- Uses inline CSS for better compatibility
- Avoids CSS properties not supported in older clients

## Testing

### Manual Testing Checklist
- [ ] Desktop: Chrome, Firefox, Safari, Edge
- [ ] Mobile: iOS Mail, Gmail app, Outlook app
- [ ] Webmail: Gmail, Outlook.com, Yahoo
- [ ] Desktop clients: Outlook 2016+, Thunderbird, Apple Mail

### Automated Testing Tools
- Litmus
- Email on Acid
- Mailchimp's inbox preview
- Campaign Monitor's testing tools

### Key Test Cases
- [ ] Images display correctly
- [ ] Links are clickable and point to correct URLs
- [ ] Buttons render properly
- [ ] Text is readable on all backgrounds
- [ ] Layout doesn't break on narrow screens
- [ ] Dark mode compatibility (where supported)

## Usage

Templates use placeholder variables like `{{firstName}}` that should be replaced with actual data when sending emails.

## Best Practices

- Keep content concise
- Use clear call-to-action buttons
- Include unsubscribe links
- Test every template before sending to users
- Monitor deliverability and engagement metrics