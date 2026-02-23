import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Privacy Policy | W-AI",
  description: "Privacy Policy for W-AI (ChatCB) – WhatsApp Marketing & Automation Platform. How we collect, use, and protect your data, including Meta/WhatsApp integration.",
}

const CONTACT_EMAIL = "privacy@example.com" // Replace with your privacy contact email
const COMPANY_NAME = "W-AI"
const PRODUCT_NAME = "W-AI (ChatCB)"
const LAST_UPDATED = "February 10, 2026"

export default function PrivacyPage() {
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
        <h1 className="text-3xl font-bold tracking-tight mb-2">Privacy Policy</h1>
        <p className="text-muted-foreground text-sm mb-8">Last updated: {LAST_UPDATED}</p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-xl font-semibold mb-3">1. Introduction</h2>
            <p>
              {COMPANY_NAME} (“we”, “us”, “our”) operates the {PRODUCT_NAME} platform, a WhatsApp
              marketing and automation service for businesses that uses the Meta WhatsApp Business
              API. This Privacy Policy explains how we collect, use, disclose, and safeguard
              information when you or your end users interact with our service, including data
              that may be shared with or processed by Meta (Facebook) and WhatsApp in accordance
              with their terms and policies.
            </p>
            <p>
              By using our service, you agree to this Privacy Policy. If you do not agree, please
              do not use our platform. We comply with applicable data protection laws and with
              Meta’s and WhatsApp’s requirements for Business Solution providers.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. Information We Collect</h2>
            <h3 className="text-lg font-medium mt-4 mb-2">2.1 Account and business users</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Name, email address, and phone number</li>
              <li>Account credentials and authentication data</li>
              <li>Role and permissions within the platform</li>
              <li>Usage data (e.g. features used, actions taken)</li>
            </ul>
            <h3 className="text-lg font-medium mt-4 mb-2">2.2 Contacts and messaging (end users)</h3>
            <p className="mb-2">
              To provide WhatsApp messaging and automation, we collect and process:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Phone numbers and names of contacts who communicate via your connected WhatsApp Business number</li>
              <li>Message content (text, images, audio, video, documents) sent and received through our platform</li>
              <li>Message status (sent, delivered, read) and timestamps</li>
              <li>Tags, segments, and custom fields you assign to contacts</li>
            </ul>
            <h3 className="text-lg font-medium mt-4 mb-2">2.3 Technical and operational data</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Logs and identifiers related to WhatsApp/Meta API (e.g. message IDs, webhook events)</li>
              <li>Stored files and media (e.g. for campaigns, templates, chat attachments)</li>
              <li>Template content and campaign metadata</li>
              <li>Product/catalog data if you connect e‑commerce integrations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. How We Use Information</h2>
            <p>We use the information we collect to:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>Provide, operate, and maintain the {PRODUCT_NAME} service</li>
              <li>Send and receive messages and deliver status updates via the WhatsApp Business API</li>
              <li>Manage contacts, chats, campaigns, templates, and automation workflows</li>
              <li>Authenticate users and enforce security</li>
              <li>Comply with legal obligations and Meta/WhatsApp policies</li>
              <li>Improve our service, fix errors, and support you</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. Sharing with Meta and WhatsApp</h2>
            <p>
              Our service is built on the <strong>Meta WhatsApp Business API</strong> (Cloud API).
              When you or your contacts use messaging features:
            </p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>Message content, phone numbers, and related data are processed by Meta/WhatsApp as
                necessary to deliver messages and provide the API. This is governed by{" "}
                <a
                  href="https://www.whatsapp.com/legal/business-terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline"
                >
                  WhatsApp Business Terms
                </a>
                ,{" "}
                <a
                  href="https://www.whatsapp.com/legal/business-app-privacy-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline"
                >
                  WhatsApp Business Privacy Policy
                </a>
                , and{" "}
                <a
                  href="https://www.whatsapp.com/legal/meta-terms-whatsapp-business"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline"
                >
                  Meta Terms for WhatsApp Business
                </a>
                .
              </li>
              <li>We do not sell your or your contacts’ personal information to Meta or any third
                party for their advertising. We share data only as required to operate the WhatsApp
                Business API and as described in this policy.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. Data Retention</h2>
            <p>
              We retain account, contact, message, and campaign data for as long as your account
              is active and as needed to provide the service, comply with law, and resolve
              disputes. You may request deletion of your data (see Your Rights below). Logs and
              backup data may be retained for a limited period after deletion for security and
              legal compliance.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. Security</h2>
            <p>
              We use industry-standard measures to protect your data, including encryption in
              transit and at rest, access controls, and secure infrastructure. Access to the
              WhatsApp Business API and your data is restricted to authorized personnel and
              systems necessary to operate the service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. Your Rights</h2>
            <p>Depending on your location, you may have the right to:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>Access and receive a copy of your personal data</li>
              <li>Correct or update your data</li>
              <li>Request deletion of your data</li>
              <li>Object to or restrict certain processing</li>
              <li>Data portability where applicable</li>
              <li>Withdraw consent where processing is based on consent</li>
              <li>Lodge a complaint with a supervisory authority (e.g. in the EU/EEA)</li>
            </ul>
            <p className="mt-3">
              To exercise these rights or for any privacy-related request, contact us at{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary underline">
                {CONTACT_EMAIL}
              </a>
              . We will respond in accordance with applicable law.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">8. International Transfers</h2>
            <p>
              Your data may be processed in countries where we or our service providers (including
              Meta) operate. We ensure appropriate safeguards (e.g. standard contractual clauses
              or adequacy decisions) where required by law for transfers outside your country.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">9. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will post the updated
              version on this page and update the “Last updated” date. Continued use of the
              service after changes constitutes acceptance of the revised policy. For material
              changes, we may provide additional notice (e.g. by email or in-app).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">10. Contact Us</h2>
            <p>
              For privacy questions, requests, or complaints:
            </p>
            <p className="mt-2">
              Email:{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary underline">
                {CONTACT_EMAIL}
              </a>
            </p>
            <p className="mt-2 text-muted-foreground text-sm">
              This policy is intended to meet the privacy disclosure requirements of the Meta
              WhatsApp Business Platform and applicable data protection laws.
            </p>
          </section>
        </div>

        <footer className="mt-12 pt-8 border-t border-border flex flex-wrap gap-4 text-sm text-muted-foreground">
          <Link href="/terms" className="hover:text-foreground underline">Terms of Service</Link>
          <Link href="/" className="hover:text-foreground underline">Home</Link>
        </footer>
      </main>
    </div>
  )
}
