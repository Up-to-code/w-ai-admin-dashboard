import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Terms of Service | W-AI",
  description: "Terms of Service for W-AI (ChatCB) – WhatsApp Marketing & Automation Platform. Acceptable use, Meta/WhatsApp compliance, and legal terms.",
}

const CONTACT_EMAIL = "legal@example.com" // Replace with your legal/contact email
const COMPANY_NAME = "W-AI"
const PRODUCT_NAME = "W-AI (ChatCB)"
const LAST_UPDATED = "February 10, 2026"

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-3xl px-4 py-4 sm:px-6">
          <Link
            href="/"
            className="text-sm font-medium text-primary hover:underline"
          >
            ← Back to {PRODUCT_NAME}
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 pb-16">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Terms of Service</h1>
        <p className="text-muted-foreground text-sm mb-8">Last updated: {LAST_UPDATED}</p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-xl font-semibold mb-3">1. Agreement to Terms</h2>
            <p>
              By accessing or using the {PRODUCT_NAME} platform (“Service”) provided by {COMPANY_NAME}
              (“we”, “us”, “our”), you agree to be bound by these Terms of Service (“Terms”). If
              you are using the Service on behalf of an organization, you represent that you have
              authority to bind that organization. If you do not agree to these Terms, do not use
              the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. Description of Service</h2>
            <p>
              {PRODUCT_NAME} is a business messaging and automation platform that connects to the
              <strong> Meta WhatsApp Business API</strong> (Cloud API). The Service allows you to
              send and receive WhatsApp messages, manage contacts, run campaigns, use templates,
              automate workflows, and integrate with third-party services (e.g. e‑commerce). Use
              of the Service is subject to your compliance with Meta’s and WhatsApp’s applicable
              terms, policies, and messaging standards.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. Acceptable Use and WhatsApp/Meta Policies</h2>
            <p>You agree to use the Service only in compliance with:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>
                <strong>WhatsApp Business Policy</strong> and{" "}
                <a
                  href="https://www.whatsapp.com/legal/business-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline"
                >
                  WhatsApp Business Messaging Policy
                </a>
                {" "}(e.g. no spam, no prohibited content, consent where required)
              </li>
              <li>
                <strong>Meta Terms for WhatsApp Business</strong> and any other Meta/WhatsApp
                terms that apply to your use of the API
              </li>
              <li>Applicable laws (e.g. anti-spam, data protection, consumer protection)</li>
            </ul>
            <p className="mt-3">
              You must not use the Service to send unsolicited messages, harass users, distribute
              malware, or promote illegal or prohibited content. You are responsible for obtaining
              necessary consents (e.g. for marketing) from your contacts. We may suspend or
              terminate access if we reasonably believe you have violated these Terms or
              Meta/WhatsApp policies.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. Account and Security</h2>
            <p>
              You are responsible for maintaining the confidentiality of your account credentials
              and for all activity under your account. You must notify us promptly of any
              unauthorized use. We are not liable for losses resulting from unauthorized access
              due to your failure to safeguard credentials.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. Data and Privacy</h2>
            <p>
              Our collection and use of personal data are described in our{" "}
              <Link href="/privacy" className="text-primary underline">Privacy Policy</Link>.
              By using the Service, you also agree to that policy. You must ensure that your
              collection and use of end-user data (e.g. contacts) complies with applicable privacy
              laws and that you have provided any required notices and obtained any required
              consents.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. Intellectual Property</h2>
            <p>
              We (or our licensors) own all rights in the Service, including software, design,
              and branding. We grant you a limited, non-exclusive, non-transferable license to
              use the Service in accordance with these Terms. You retain rights in content you
              upload; you grant us a license to use, store, and process that content as needed
              to provide the Service and as set out in our Privacy Policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. Disclaimers</h2>
            <p>
              THE SERVICE IS PROVIDED “AS IS” AND “AS AVAILABLE.” WE DISCLAIM ALL WARRANTIES,
              EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE,
              AND NON-INFRINGEMENT. WE DO NOT GUARANTEE UNINTERRUPTED OR ERROR-FREE OPERATION.
              DEPENDENCY ON META/WHATSAPP AND THIRD-PARTY SERVICES MAY AFFECT AVAILABILITY.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">8. Limitation of Liability</h2>
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE (AND OUR AFFILIATES, OFFICERS,
              EMPLOYEES, AND AGENTS) SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL,
              CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR FOR LOSS OF PROFITS, DATA, OR GOODWILL,
              ARISING FROM OR RELATED TO YOUR USE OF THE SERVICE. OUR TOTAL LIABILITY FOR ANY
              CLAIMS ARISING UNDER OR RELATED TO THESE TERMS SHALL NOT EXCEED THE AMOUNT YOU
              PAID US IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM (OR ONE HUNDRED US DOLLARS
              IF GREATER). SOME JURISDICTIONS DO NOT ALLOW CERTAIN LIMITATIONS; IN SUCH CASES
              OUR LIABILITY WILL BE LIMITED TO THE MAXIMUM EXTENT PERMITTED BY LAW.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">9. Indemnification</h2>
            <p>
              You agree to indemnify and hold harmless {COMPANY_NAME} and its affiliates,
              officers, employees, and agents from any claims, damages, losses, or expenses
              (including reasonable legal fees) arising from your use of the Service, your
              violation of these Terms, your violation of any third-party rights (including
              Meta/WhatsApp policies), or your violation of applicable law.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">10. Termination</h2>
            <p>
              We may suspend or terminate your access to the Service at any time for breach of
              these Terms, violation of Meta/WhatsApp policies, or for any other reason with
              notice where practicable. You may stop using the Service at any time. Upon
              termination, your right to use the Service ceases. Provisions that by their nature
              should survive (e.g. disclaimers, limitation of liability, indemnification) will
              survive.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">11. Changes to Terms</h2>
            <p>
              We may modify these Terms from time to time. We will post the updated Terms on this
              page and update the “Last updated” date. Continued use of the Service after changes
              constitutes acceptance. For material changes, we may provide additional notice (e.g.
              by email or in-app). If you do not agree, you must stop using the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">12. General</h2>
            <p>
              These Terms constitute the entire agreement between you and {COMPANY_NAME}
              regarding the Service. If any provision is held invalid, the remaining provisions
              remain in effect. Our failure to enforce any right does not waive that right. You
              may not assign these Terms without our consent; we may assign them in connection
              with a merger, acquisition, or sale of assets. Governing law and dispute resolution
              will be as required by your jurisdiction; you may have mandatory consumer rights
              that cannot be waived.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">13. Contact</h2>
            <p>
              For questions about these Terms:
            </p>
            <p className="mt-2">
              Email:{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary underline">
                {CONTACT_EMAIL}
              </a>
            </p>
          </section>
        </div>

        <footer className="mt-12 pt-8 border-t border-border flex flex-wrap gap-4 text-sm text-muted-foreground">
          <Link href="/privacy" className="hover:text-foreground underline">Privacy Policy</Link>
          <Link href="/" className="hover:text-foreground underline">Home</Link>
        </footer>
      </main>
    </div>
  )
}
