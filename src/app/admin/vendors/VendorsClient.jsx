'use client';

import React, { useState } from 'react';
import { createManualVendor, resolveVendorMapping, updateVendorStatus } from './actions';
import styles from './page.module.css';

const ALLOWED_STATUSES = ['Approved', 'Pending', 'Inactive', 'Blacklisted'];

function statusBadgeClass(status) {
  if (status === 'Approved') return styles.badgeApproved;
  if (status === 'Pending') return styles.badgePending;
  if (status === 'Inactive') return styles.badgeInactive;
  if (status === 'Blacklisted') return styles.badgeBlacklisted;
  return styles.badgePending;
}

function matchBadgeClass(matchStatus) {
  if (matchStatus === 'auto_matched') return styles.badgeAutoMatch;
  if (matchStatus === 'manually_matched') return styles.badgeManual;
  if (matchStatus === 'unmatched') return styles.badgeUnmatched;
  if (matchStatus === 'ambiguous') return styles.badgeAmbiguous;
  return styles.badgePending;
}

export default function VendorsClient({ initialVendors = [], initialMappings = [] }) {
  const [vendors, setVendors] = useState(initialVendors);
  const [mappings, setMappings] = useState(initialMappings);
  const [activeTab, setActiveTab] = useState('vendors'); // 'vendors' | 'mappings' | 'create'

  // Create Form State
  const emptyForm = {
    name: '',
    vendor_type: 'General',
    ntn: '',
    strn: '',
    province: '',
    default_wht_category: '',
    default_gst_category: '',
    filer_status: 'Non-Filer',
    business_name: '',
    business_address: '',
    contact_email: '',
    contact_phone: '',
    bank_account_title: '',
    iban: '',
    bank_account_number: '',
    bank_name: '',
    notes: '',
  };
  const [newVendor, setNewVendor] = useState(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Per-row status update state — keyed by vendor id
  const [statusBusy, setStatusBusy] = useState({});

  // Mapping Resolution State
  const [resolvingId, setResolvingId] = useState(null);
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [resolveNotes, setResolveNotes] = useState('');
  const [resolveBusy, setResolveBusy] = useState(false);

  // ── Create vendor ─────────────────────────────────────────────

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setIsSubmitting(true);

    if (!newVendor.name.trim()) {
      setErrorMsg('Vendor Name is required');
      setIsSubmitting(false);
      return;
    }

    const res = await createManualVendor(newVendor.name, newVendor);
    setIsSubmitting(false);

    if (!res.ok) {
      setErrorMsg(res.error || 'Failed to create vendor');
      return;
    }

    setSuccessMsg(`Vendor "${res.vendor.name}" created with code ${res.vendor.vendor_code}.`);
    setVendors((prev) => [...prev, res.vendor].sort((a, b) => a.name.localeCompare(b.name)));
    setNewVendor(emptyForm);
    setActiveTab('vendors');
  };

  // ── Status toggle ─────────────────────────────────────────────

  const handleStatusChange = async (vendorId, newStatus) => {
    setStatusBusy((prev) => ({ ...prev, [vendorId]: true }));
    setErrorMsg('');

    const res = await updateVendorStatus(vendorId, newStatus);

    setStatusBusy((prev) => ({ ...prev, [vendorId]: false }));

    if (!res.ok) {
      setErrorMsg(res.error || 'Failed to update vendor status');
      return;
    }

    setVendors((prev) =>
      prev.map((v) => (v.id === vendorId ? { ...v, status: res.vendor.status } : v))
    );
    setSuccessMsg(`${res.vendor.name} — status set to ${res.vendor.status}.`);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  // ── Mapping resolve ───────────────────────────────────────────

  const handleResolveSubmit = async (mapping) => {
    if (!selectedVendorId) {
      alert('Please select a target vendor');
      return;
    }
    setResolveBusy(true);

    const res = await resolveVendorMapping(
      mapping.id,
      selectedVendorId,
      'manually_matched',
      resolveNotes
    );

    setResolveBusy(false);

    if (!res.ok) {
      alert(res.error);
      return;
    }

    setMappings((prev) =>
      prev.map((m) => (m.id === mapping.id ? res.mapping : m))
    );
    setResolvingId(null);
    setSelectedVendorId('');
    setResolveNotes('');
  };

  // ── Render ────────────────────────────────────────────────────

  return (
    <div>
      {/* Tabs */}
      <div className={styles.tabs}>
        <button
          type="button"
          onClick={() => setActiveTab('vendors')}
          className={`${styles.tab} ${activeTab === 'vendors' ? styles.tabActive : ''}`}
        >
          Active Vendors ({vendors.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('mappings')}
          className={`${styles.tab} ${activeTab === 'mappings' ? styles.tabActive : ''}`}
        >
          Historical Name Mappings ({mappings.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('create')}
          className={`${styles.tab} ${activeTab === 'create' ? styles.tabActive : ''}`}
        >
          + Add New Vendor
        </button>
      </div>

      {successMsg && <div className={styles.success}>{successMsg}</div>}
      {errorMsg && <div className={styles.error}>{errorMsg}</div>}

      {/* ── Tab: Vendor List ──────────────────────────────────── */}
      {activeTab === 'vendors' && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Type</th>
                <th>NTN</th>
                <th>Source</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {vendors.length === 0 ? (
                <tr>
                  <td colSpan={6} className={styles.empty}>
                    No vendors found. Migration 0005 may not be applied yet.
                  </td>
                </tr>
              ) : (
                vendors.map((v) => (
                  <tr key={v.id}>
                    <td className={styles.mono}>{v.vendor_code}</td>
                    <td style={{ fontWeight: 500 }}>{v.name}</td>
                    <td>{v.vendor_type || '—'}</td>
                    <td className={v.ntn ? undefined : styles.muted}>{v.ntn || '—'}</td>
                    <td style={{ textTransform: 'capitalize' }}>{v.source}</td>
                    <td>
                      <select
                        className={styles.statusSelect}
                        value={v.status}
                        disabled={!!statusBusy[v.id]}
                        onChange={(e) => handleStatusChange(v.id, e.target.value)}
                        aria-label={`Change status for ${v.name}`}
                      >
                        {ALLOWED_STATUSES.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Tab: Historical Mappings ──────────────────────────── */}
      {activeTab === 'mappings' && (
        <div>
          <p className={styles.hint}>
            Historical transactions may contain raw vendor name variations. Map each raw name to a stable Vendor Master record.
            Saving a mapping also updates any existing <code>vendor_bills</code> rows with a matching raw name and no vendor ID.
          </p>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Raw Name</th>
                  <th>Mapped Vendor</th>
                  <th>Match Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {mappings.length === 0 ? (
                  <tr>
                    <td colSpan={4} className={styles.empty}>
                      No historical mappings. Migration 0005 may not be applied yet.
                    </td>
                  </tr>
                ) : (
                  mappings.map((m) => {
                    const mappedVendor = vendors.find((v) => v.id === m.vendor_id);
                    const isResolving = resolvingId === m.id;

                    return (
                      <tr key={m.id}>
                        <td style={{ fontWeight: 500 }}>{m.raw_name}</td>
                        <td className={mappedVendor ? undefined : styles.muted}>
                          {mappedVendor
                            ? `${mappedVendor.name} (${mappedVendor.vendor_code})`
                            : '— Unmapped'}
                        </td>
                        <td>
                          <span className={`${styles.badge} ${matchBadgeClass(m.match_status)}`}>
                            {m.match_status.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td>
                          {isResolving ? (
                            <div className={styles.resolveRow}>
                              <select
                                className={styles.resolveSelect}
                                value={selectedVendorId}
                                onChange={(e) => setSelectedVendorId(e.target.value)}
                              >
                                <option value="">— Choose Vendor —</option>
                                {vendors
                                  .filter((v) => v.status === 'Approved')
                                  .map((v) => (
                                    <option key={v.id} value={v.id}>{v.name}</option>
                                  ))}
                              </select>
                              <input
                                type="text"
                                placeholder="Notes (optional)"
                                value={resolveNotes}
                                onChange={(e) => setResolveNotes(e.target.value)}
                                className={styles.resolveInput}
                              />
                              <button
                                type="button"
                                onClick={() => handleResolveSubmit(m)}
                                className={styles.btnSave}
                                disabled={resolveBusy}
                              >
                                {resolveBusy ? 'Saving…' : 'Save'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setResolvingId(null)}
                                className={styles.btnCancel}
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setResolvingId(m.id);
                                setSelectedVendorId(m.vendor_id || '');
                                setResolveNotes(m.notes || '');
                              }}
                              className={styles.btnSmall}
                            >
                              Edit Match
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Tab: Create Manual Vendor ─────────────────────────── */}
      {activeTab === 'create' && (
        <form onSubmit={handleCreateSubmit} className={styles.createForm}>
          <h2>New Vendor Profile</h2>

          <div className={styles.formGrid}>
            {/* Core identifiers */}
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Vendor Display Name (unique) *</label>
              <input
                type="text"
                value={newVendor.name}
                onChange={(e) => setNewVendor({ ...newVendor, name: e.target.value })}
                placeholder="e.g. Afil Industries"
                className={styles.fieldInput}
                required
              />
            </div>

            <div className={styles.field}>
              <label className={styles.fieldLabel}>Vendor Type</label>
              <select
                value={newVendor.vendor_type}
                onChange={(e) => setNewVendor({ ...newVendor, vendor_type: e.target.value })}
                className={styles.fieldSelect}
              >
                <option value="General">General / Logistics</option>
                <option value="Raw Materials">Raw Materials / Inventory</option>
                <option value="Beverages">Beverages</option>
                <option value="Packaging">Packaging</option>
                <option value="Services">Professional Services</option>
              </select>
            </div>

            {/* Tax profile */}
            <div className={styles.field}>
              <label className={styles.fieldLabel}>NTN (National Tax Number)</label>
              <input
                type="text"
                value={newVendor.ntn}
                onChange={(e) => setNewVendor({ ...newVendor, ntn: e.target.value })}
                className={styles.fieldInput}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.fieldLabel}>STRN / GST Reg Number</label>
              <input
                type="text"
                value={newVendor.strn}
                onChange={(e) => setNewVendor({ ...newVendor, strn: e.target.value })}
                className={styles.fieldInput}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.fieldLabel}>Filer Status</label>
              <select
                value={newVendor.filer_status}
                onChange={(e) => setNewVendor({ ...newVendor, filer_status: e.target.value })}
                className={styles.fieldSelect}
              >
                <option value="Active">Active Filer</option>
                <option value="Non-Filer">Non-Filer</option>
              </select>
            </div>

            {/* Business contacts */}
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Primary Contact Email</label>
              <input
                type="email"
                value={newVendor.contact_email}
                onChange={(e) => setNewVendor({ ...newVendor, contact_email: e.target.value })}
                className={styles.fieldInput}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.fieldLabel}>Primary Contact Phone</label>
              <input
                type="text"
                value={newVendor.contact_phone}
                onChange={(e) => setNewVendor({ ...newVendor, contact_phone: e.target.value })}
                placeholder="0300-1234567"
                className={styles.fieldInput}
              />
            </div>

            {/* Bank details */}
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Bank Account Title</label>
              <input
                type="text"
                value={newVendor.bank_account_title}
                onChange={(e) => setNewVendor({ ...newVendor, bank_account_title: e.target.value })}
                className={styles.fieldInput}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.fieldLabel}>Bank Name</label>
              <input
                type="text"
                value={newVendor.bank_name}
                onChange={(e) => setNewVendor({ ...newVendor, bank_name: e.target.value })}
                className={styles.fieldInput}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.fieldLabel}>IBAN (24 characters)</label>
              <input
                type="text"
                value={newVendor.iban}
                onChange={(e) => setNewVendor({ ...newVendor, iban: e.target.value })}
                placeholder="PK00XXXX0000000000000000"
                className={styles.fieldInput}
              />
            </div>
          </div>

          <div className={styles.formActions}>
            <button type="submit" disabled={isSubmitting} className={styles.btnPrimary}>
              {isSubmitting ? 'Saving…' : 'Save Vendor Profile'}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('vendors')}
              className={styles.btnSecondary}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
