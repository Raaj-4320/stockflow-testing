import React from 'react';
import LegalPageLayout from './LegalPageLayout';

export default function PrivacyPolicy() {
  return (
    <LegalPageLayout
      title="Privacy Policy"
      description="This page explains how Stockflow handles business data used for ERP workflows, reporting, invoicing, inventory, payments, and communication."
      icon="privacy"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Last updated: June 2026</p>
      <p>
        Stockflow is an ERP and business management application used for managing customers, invoices, ledgers, payments, inventory, reports, and business communication.
      </p>
      <section className="space-y-2">
        <h2 className="text-base font-semibold text-slate-950">Information We Collect</h2>
        <p>We may collect and store business-related information entered into Stockflow, including:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Customer names</li>
          <li>Customer phone numbers</li>
          <li>Invoice and transaction details</li>
          <li>Payment and ledger records</li>
          <li>Product and inventory information</li>
          <li>Business profile details</li>
          <li>WhatsApp message delivery or communication status</li>
          <li>User account and authentication information</li>
        </ul>
      </section>
      <section className="space-y-2">
        <h2 className="text-base font-semibold text-slate-950">How We Use Information</h2>
        <p>We use this information to provide ERP features such as:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Creating and managing invoices</li>
          <li>Maintaining customer ledgers</li>
          <li>Sending invoice, ledger, payment, and business notifications</li>
          <li>Managing stock and transactions</li>
          <li>Generating reports</li>
          <li>Improving reliability and business workflow</li>
        </ul>
      </section>
      <p>
        <span className="font-semibold text-slate-950">WhatsApp Communication</span><br />
        Stockflow may use WhatsApp Business Platform to send business-related messages such as invoices, statements, payment updates, ledgers, and reminders. These messages are sent only for business communication related to the user&apos;s transactions or account.
      </p>
      <p>
        <span className="font-semibold text-slate-950">Data Sharing</span><br />
        We do not sell personal or customer data.
      </p>
      <p>
        We may share limited information with service providers required to operate the application, such as hosting providers, database providers, authentication providers, and WhatsApp/Meta services for business messaging.
      </p>
      <p>
        <span className="font-semibold text-slate-950">Data Security</span><br />
        We use reasonable technical and organizational measures to protect business and customer data. However, no online system can be guaranteed to be completely secure.
      </p>
      <p>
        <span className="font-semibold text-slate-950">Data Retention</span><br />
        Business records may be retained as long as needed for accounting, reporting, legal, operational, or business continuity purposes.
      </p>
      <p>
        <span className="font-semibold text-slate-950">Data Deletion</span><br />
        Users or customers may request deletion of their data by contacting us at <a className="font-medium text-slate-900 hover:underline" href="mailto:work.raj01@gmail.com">work.raj01@gmail.com</a>.
      </p>
      <p>
        Some records, such as invoices, payments, ledgers, and tax/accounting records, may need to be retained where legally or operationally required.
      </p>
      <p>
        <span className="font-semibold text-slate-950">Contact</span><br />
        For privacy questions or deletion requests, contact <a className="font-medium text-slate-900 hover:underline" href="mailto:work.raj01@gmail.com">work.raj01@gmail.com</a>.
      </p>
    </LegalPageLayout>
  );
}
