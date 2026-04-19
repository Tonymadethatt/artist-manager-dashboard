import { PublicLayout } from '@/components/public/PublicLayout'

export default function TermsPage() {
  return (
    <PublicLayout title="Terms of Service">
      <Section title="Overview">
        <p>
          These Terms of Service govern the artist management relationship between Front Office Brand Growth &amp; Management
          ("Manager") and DJ Luijay ("Artist"), as well as any agreements made on behalf of the Artist with third-party
          clients, venues, and partners ("Clients").
        </p>
        <p>
          By entering into a booking, sponsorship, or performance agreement referencing this page, all parties agree to
          the terms outlined below.
        </p>
      </Section>

      <Section title="1. Scope of Management">
        <p>
          The Manager provides the following services on behalf of the Artist:
        </p>
        <ul>
          <li>Venue and event outreach and booking coordination</li>
          <li>Deal negotiation and agreement drafting</li>
          <li>Brand partnership development</li>
          <li>Follow-up, communication, and relationship management with Clients</li>
          <li>Performance logistics coordination</li>
        </ul>
      </Section>

      <Section title="2. Booking Agreements">
        <p>
          All bookings are considered confirmed only upon receipt of a signed agreement or written confirmation from both
          the Client and the Artist or Manager. Verbal commitments do not constitute a binding agreement.
        </p>
        <p>
          Agreements will specify: performance date and time, load-in requirements, set length, agreed compensation, and
          any specific technical or hospitality riders.
        </p>
      </Section>

      <Section title="3. Payment Terms">
        <p>
          Unless otherwise specified in the booking agreement:
        </p>
        <ul>
          <li>A deposit of 50% is due upon signing of the agreement to secure the date.</li>
          <li>The remaining balance is due no later than 7 days prior to the performance date.</li>
          <li>Late payments may result in cancellation at the Manager's or Artist's discretion.</li>
          <li>All payments should be made to the account or method specified in the individual agreement.</li>
        </ul>
        <p>
          Payments confirm the Client's acceptance of all terms outlined herein and in the booking agreement.
        </p>
      </Section>

      <Section title="4. Cancellation Policy">
        <p>
          Cancellations must be submitted in writing to management@djluijay.live:
        </p>
        <ul>
          <li><strong>More than 30 days before event:</strong> Deposit is non-refundable; no further obligation.</li>
          <li><strong>15–30 days before event:</strong> 50% of the total agreed fee is owed.</li>
          <li><strong>Less than 15 days before event:</strong> Full agreed fee is owed.</li>
        </ul>
        <p>
          The Artist reserves the right to cancel in cases of illness, emergency, or force majeure. In such cases, a full
          refund of any deposit will be issued.
        </p>
      </Section>

      <Section title="5. Performance Standards">
        <p>
          The Artist commits to:
        </p>
        <ul>
          <li>Arriving at the agreed load-in time</li>
          <li>Performing for the agreed set length</li>
          <li>Maintaining professional conduct at all times</li>
        </ul>
        <p>
          The Client commits to providing the technical setup, hospitality, and safe environment outlined in the agreement.
          Failure to meet these conditions may void the agreement at the Manager's or Artist's discretion without refund obligation.
        </p>
      </Section>

      <Section title="6. Intellectual Property">
        <p>
          The Artist retains all rights to their music, brand, name, likeness, and any recordings made during performances.
          Clients may not record, broadcast, or commercially distribute any performance without prior written permission
          from the Artist or Manager.
        </p>
        <p>
          Social media posts, promotional use of the Artist's name, and press mentions must be approved in advance.
        </p>
      </Section>

      <Section title="7. Commission">
        <p>
          The Manager is entitled to a commission on all bookings and deals secured during the management period, as agreed
          in the separate management agreement. Commission rates vary by deal type (New Doors, Booked Doors, Bigger Doors)
          as outlined in that agreement.
        </p>
      </Section>

      <Section title="8. Limitation of Liability">
        <p>
          Neither the Artist nor the Manager shall be liable for circumstances beyond their reasonable control, including
          but not limited to: natural disasters, government actions, venue shutdowns, or other force majeure events.
        </p>
        <p>
          Liability in all cases is limited to the amount paid under the specific booking agreement.
        </p>
      </Section>

      <Section title="9. Governing Law">
        <p>
          These terms are governed by the laws of the United States. Any disputes shall be resolved through good-faith
          negotiation. If negotiation fails, disputes shall be handled through binding arbitration.
        </p>
      </Section>

      <Section title="10. Contact">
        <p>
          For questions about these terms, to request modifications to a booking, or for any other inquiries:
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
