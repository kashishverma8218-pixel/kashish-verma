import React, { useState, useEffect } from 'react';
import { X, Flag, MessageSquarePlus, CheckCircle2, Loader2 } from 'lucide-react';
import { submitContentReport } from '../services/firebaseDatabaseService';
import { useAuth } from '../context/AuthContext';

export interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetId: string;
  targetType: 'video' | 'reel' | 'comment';
  targetTitle?: string;
  mode?: 'report' | 'feedback';
}

const REPORT_REASONS = [
  'Spam or misleading',
  'Hateful or abusive content',
  'Harassment or bullying',
  'Harmful or dangerous acts',
  'Copyright or rights infringement',
  'Sexual or inappropriate content',
  'Playback bug / technical feedback',
];

export const ReportModal: React.FC<ReportModalProps> = ({
  isOpen,
  onClose,
  targetId,
  targetType,
  targetTitle,
  mode = 'report',
}) => {
  const { currentUser } = useAuth();
  const [selectedReason, setSelectedReason] = useState(
    mode === 'feedback' ? 'Playback bug / technical feedback' : REPORT_REASONS[0]
  );
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submittedMode, setSubmittedMode] = useState<'cloud' | 'local' | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSelectedReason(
        mode === 'feedback' ? 'Playback bug / technical feedback' : REPORT_REASONS[0]
      );
      setDetails('');
      setSubmittedMode(null);
      setErrorMsg(null);
    }
  }, [isOpen, mode, targetId]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const storageTarget = await submitContentReport(
        targetId,
        targetType,
        selectedReason,
        details.trim()
      );
      setSubmittedMode(storageTarget);
      setTimeout(() => {
        onClose();
      }, 1400);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Unable to submit report right now.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-modal-title"
        className="relative w-full max-w-md rounded-2xl border border-[var(--ink-faint)] bg-[var(--surface-elevated)] p-5 sm:p-6 shadow-2xl text-[var(--ink)] max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between pb-3.5 border-b border-[var(--ink-faint)]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FF0000]/15 text-[var(--accent-ink)]">
              {mode === 'feedback' ? (
                <MessageSquarePlus className="h-4.5 w-4.5" />
              ) : (
                <Flag className="h-4.5 w-4.5" />
              )}
            </div>
            <div className="min-w-0">
              <h3 id="report-modal-title" className="text-base font-bold text-[var(--ink)] truncate">
                {mode === 'feedback' ? 'Send Feedback' : `Report ${targetType}`}
              </h3>
              {targetTitle && (
                <p className="text-xs text-[var(--ink-medium)] truncate">{targetTitle}</p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--ink-medium)] hover:bg-[var(--card-hover)] hover:text-[var(--ink)] transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {submittedMode ? (
          <div className="py-8 text-center space-y-2.5 animate-in fade-in duration-200">
            <CheckCircle2 className="h-11 w-11 text-emerald-500 mx-auto" />
            <h4 className="text-base font-bold text-[var(--ink)]">
              {mode === 'feedback' ? 'Feedback received' : 'Report submitted'}
            </h4>
            <p className="text-xs text-[var(--ink-medium)] max-w-xs mx-auto leading-relaxed">
              {submittedMode === 'cloud'
                ? 'Thank you for helping keep Vio streaming safe and reliable. Our moderation queue has recorded your submission.'
                : 'Recorded for this session. Sign in to sync moderation reports directly with your account.'}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div className="space-y-1.5">
              <span className="block text-xs font-bold text-[var(--ink)]">
                {mode === 'feedback' ? 'Topic' : 'Select a reason'}
              </span>
              <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                {REPORT_REASONS.map((reason) => {
                  const active = selectedReason === reason;
                  return (
                    <button
                      key={reason}
                      type="button"
                      onClick={() => setSelectedReason(reason)}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-medium border transition-colors cursor-pointer ${
                        active
                          ? 'border-[#FF0000] bg-[#FF0000]/10 text-[var(--ink)] font-semibold'
                          : 'border-[var(--ink-faint)] bg-[var(--bg)] text-[var(--ink-medium)] hover:bg-[var(--card-hover)] hover:text-[var(--ink)]'
                      }`}
                    >
                      <span
                        className={`h-4 w-4 rounded-full border flex items-center justify-center shrink-0 ${
                          active ? 'border-[#FF0000]' : 'border-[var(--ink-medium)]'
                        }`}
                      >
                        {active && <span className="h-2 w-2 rounded-full bg-[#FF0000]" />}
                      </span>
                      <span>{reason}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--ink)] mb-1">
                Additional details (optional)
              </label>
              <textarea
                rows={3}
                maxLength={2000}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder={
                  mode === 'feedback'
                    ? 'Describe what worked or what could be improved...'
                    : 'Share timestamps or context to help our review...'
                }
                className="w-full rounded-xl border border-[var(--ink-faint)] bg-[var(--bg)] px-3.5 py-2.5 text-base sm:text-xs text-[var(--ink)] placeholder:text-[var(--ink-medium)] focus:border-[#FF0000] focus:outline-none resize-none"
              />
            </div>

            {!currentUser && (
              <p className="text-[11px] text-[var(--ink-medium)]">
                You are browsing as a guest; report notes will be stored in this browser session.
              </p>
            )}

            {errorMsg && (
              <div className="rounded-xl bg-rose-500/10 border border-rose-500/20 px-3 py-2 text-xs text-rose-500">
                {errorMsg}
              </div>
            )}

            <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-end gap-2 pt-2 border-t border-[var(--ink-faint)]">
              <button
                type="button"
                onClick={onClose}
                className="min-h-[42px] rounded-xl px-4 py-2 text-xs font-bold text-[var(--ink-medium)] hover:bg-[var(--card-hover)] hover:text-[var(--ink)] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="min-h-[42px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#FF0000] px-5 py-2 text-xs font-bold text-white hover:bg-[#CC0000] disabled:opacity-50 transition-colors cursor-pointer"
              >
                {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>{mode === 'feedback' ? 'Send Feedback' : 'Submit Report'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
