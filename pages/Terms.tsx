import React from 'react';
import LegalPageLayout from './LegalPageLayout';

export default function Terms() {
  return (
    <LegalPageLayout
      title="Terms of Service"
      description="These terms describe the intended business use of Stockflow and the responsibilities of users operating the platform."
      icon="terms"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Last updated: June 2026</p>
      <p>
        These Terms of Service apply to the use of Stockflow, an ERP and business management application.
      </p>
      <p>
        <span className="font-semibold text-slate-950">Use of Stockflow</span><br />
        Stockflow is provided to help businesses manage customers, invoices, ledgers, payments, inventory, reports, and business communication.
      </p>
      <p>
        By using Stockflow, you agree to use it only for lawful business purposes.
      </p>
      <p>
        <span className="font-semibold text-slate-950">User Responsibility</span><br />
        Users are responsible for the accuracy of all data entered into Stockflow, including:
      </p>
      <ul className="list-disc space-y-1 pl-5">
        <li>Customer details</li>
        <li>Phone numbers</li>
        <li>Invoice details</li>
        <li>Payment records</li>
        <li>Ledger balances</li>
        <li>Product and inventory data</li>
        <li>Tax or GST-related information</li>
      </ul>
      <p>
        Stockflow is a business management tool and does not replace professional accounting, tax, legal, or financial advice.
      </p>
      <p>
        <span className="font-semibold text-slate-950">WhatsApp Messages</span><br />
        Stockflow may allow businesses to send WhatsApp messages related to invoices, ledgers, payment updates, business notifications, and reminders.
      </p>
      <p>
        Users are responsible for ensuring that their WhatsApp communication is appropriate, lawful, and related to legitimate business activity.
      </p>
      <p>
        <span className="font-semibold text-slate-950">Service Availability</span><br />
        We try to keep Stockflow reliable, but we do not guarantee uninterrupted or error-free service. Features may be changed, updated, paused, or removed as the product improves.
      </p>
      <p>
        <span className="font-semibold text-slate-950">Data and Records</span><br />
        Users should regularly review and verify their business records. Stockflow is not responsible for losses caused by incorrect data entry, misuse, third-party service failures, or internet/platform outages.
      </p>
      <p>
        <span className="font-semibold text-slate-950">Limitation of Liability</span><br />
        To the maximum extent permitted by law, Stockflow and its operators are not liable for indirect, incidental, or consequential damages arising from the use of the application.
      </p>
      <p>
        <span className="font-semibold text-slate-950">Contact</span><br />
        For questions about these Terms, contact <a className="font-medium text-slate-900 hover:underline" href="mailto:work.raj01@gmail.com">work.raj01@gmail.com</a>.
      </p>
    </LegalPageLayout>
  );
}
