import { PublicLayout } from '@/components/public/PublicLayout'

export default function PrivacyPage() {
  return (
    <PublicLayout title="Privacy Policy">
      <Section title="Overview">
        <p>
          This Privacy Policy describes how DJ Luijay and Front Office Brand Growth &amp; Management ("we," "us") collect,
          use, and handle information in connection with booking inquiries, agreements, and communications.
        </p>
        <p>
          We are committed to handling all information with care and transparency.
        </p>
      </Section>

      <Section title="1. Information We Collect">
        <p>We may collect the following types of information:</p>
        <ul>
          <li><strong>Contact information</strong> — name, email address, phone number, venue or organization name</li>
          <li><strong>Booking details</strong> — event dates, location, agreed terms, payment records</li>
          <li><strong>Communications</strong> — emails, messages, and notes related to bookings or inquiries</li>
        </ul>
        <p>
          We only collect information that is directly provided to us through the course of a business relationship
          or inquiry.
        </p>
      </Section>

      <Section title="2. How We Use Information">
        <p>Information collected is used solely for:</p>
        <ul>
          <li>Processing and managing bookings and agreements</li>
          <li>Communicating with Clients about events, payments, and logistics</li>
          <li>Maintaining accurate records of business activity</li>
          <li>Sending relevant updates about confirmed bookings or agreements</li>
        </ul>
        <p>
          We do not sell, trade, or rent your personal information to any third party.
        </p>
      </Section>

      <Section title="3. Data Storage">
        <p>
          Booking and contact information is stored securely in our internal management system. Access is limited to
          authorized management personnel only.
        </p>
        <p>
          We use industry-standard security measures to protect your information from unauthorized access.
        </p>
      </Section>

      <Section title="4. Email Communications">
        <p>
          By entering into a booking or inquiry with us, you consent to receiving transactional emails related to your
          booking — including confirmations, reminders, agreements, and receipts.
        </p>
        <p>
          We do not send promotional or marketing emails without your explicit consent. You may opt out of any
          non-transactional communication at any time by replying to any email with "Unsubscribe."
        </p>
      </Section>

      <Section title="5. Third-Party Services">
        <p>
          We use the following third-party services in the normal course of business:
        </p>
        <ul>
          <li><strong>Resend</strong> — for transactional email delivery</li>
          <li><strong>Supabase</strong> — for secure data storage</li>
        </ul>
        <p>
          These services are used solely for operational purposes and are bound by their own privacy policies.
          We do not share your data with these services beyond what is required for their function.
        </p>
      </Section>

      <Section title="6. Data Retention">
        <p>
          We retain booking and contact information for as long as necessary to fulfill business obligations and
          comply with any legal requirements. You may request deletion of your data by contacting us directly.
        </p>
      </Section>

      <Section title="7. Your Rights">
        <p>You have the right to:</p>
        <ul>
          <li>Request access to the information we hold about you</li>
          <li>Request correction of inaccurate information</li>
          <li>Request deletion of your information (subject to legal obligations)</li>
          <li>Opt out of non-transactional communications at any time</li>
        </ul>
      </Section>

      <Section title="8. Contact">
        <p>
          For any privacy-related questions or requests:
        </p>
        <p>
          <strong>Email:</strong>{' '}
          <a href="mailto:management@djluijay.live" className="text-white hover:underline">
            management@djluijay.live
          </a>
        </p>
      </Section>
    </PublicLayout>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h2 className="text-base font-semibold text-white">{title}</h2>
      <div className="space-y-2 text-neutral-400 text-sm leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_strong]:text-neutral-300">
        {children}
      </div>
    </div>
  )
}
