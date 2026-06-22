import React from 'react';
import LegalPageLayout from './LegalPageLayout';

export default function DataDeletion() {
  return (
    <LegalPageLayout
      title="Data Deletion Instructions"
      description="This page explains how users or customers can request deletion of personal or business-related data associated with Stockflow records."
      icon="deletion"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Last updated: June 2026</p>
      <p>
        Users and customers may request deletion of their personal or business-related data stored in Stockflow.
      </p>
      <p>
        <span className="font-semibold text-slate-950">How to Request Data Deletion</span><br />
        To request deletion, send an email to <a className="font-medium text-slate-900 hover:underline" href="mailto:work.raj01@gmail.com">work.raj01@gmail.com</a>.
      </p>
      <p>Please include:</p>
      <ul className="list-disc space-y-1 pl-5">
        <li>Your name</li>
        <li>Business name, if applicable</li>
        <li>Phone number connected to the account or customer record</li>
        <li>Details of the data you want deleted</li>
        <li>Reason for the deletion request, if you want to provide one</li>
      </ul>
      <p>
        <span className="font-semibold text-slate-950">What Happens After a Request</span><br />
        After receiving your request, we will review it and take reasonable steps to verify the request before deleting or updating the related data.
      </p>
      <p>
        <span className="font-semibold text-slate-950">Records That May Be Retained</span><br />
        Some records may need to be retained for legal, accounting, tax, fraud prevention, dispute resolution, or business operational reasons. This may include invoices, payments, ledger records, GST/tax records, and transaction history.
      </p>
      <p>
        Where full deletion is not possible, we may restrict, anonymize, or remove personal identifiers where appropriate.
      </p>
      <p>
        <span className="font-semibold text-slate-950">Contact</span><br />
        For data deletion requests, contact <a className="font-medium text-slate-900 hover:underline" href="mailto:work.raj01@gmail.com">work.raj01@gmail.com</a>.
      </p>
    </LegalPageLayout>
  );
}
