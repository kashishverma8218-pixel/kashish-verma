import React, { useState, useEffect, useRef } from 'react';
import { X, User, Save, CheckCircle2, AlertCircle, Camera, Upload, Image as ImageIcon, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { uploadImageAsset } from '../services/firebaseDatabaseService';

interface ProfileManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PRESET_AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80',
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=250&q=80',
  'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=250&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=250&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=250&q=80',
  'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=250&q=80',
];

export const ProfileManagementModal: React.FC<ProfileManagementModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { userProfile, currentUser, updateUserProfileData } = useAuth();

  const [displayName, setDisplayName] = useState(userProfile?.displayName || currentUser?.displayName || '');
  const [handle, setHandle] = useState(userProfile?.handle || '');
  const [bio, setBio] = useState(userProfile?.bio || '');
  const [photoURL, setPhotoURL] = useState(userProfile?.photoURL || currentUser?.photoURL || '');
  const [bannerURL, setBannerURL] = useState(userProfile?.bannerURL || '');
  const [isSaved, setIsSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploadingField, setUploadingField] = useState<'avatar' | 'banner' | null>(null);
  const [uploadStatusMsg, setUploadStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const avatarFileInputRef = useRef<HTMLInputElement>(null);
  const bannerFileInputRef = useRef<HTMLInputElement>(null);

  // Sync form state whenever modal opens or userProfile updates
  useEffect(() => {
    if (isOpen) {
      setDisplayName(userProfile?.displayName || currentUser?.displayName || '');
      setHandle(userProfile?.handle || '');
      setBio(userProfile?.bio || '');
      setPhotoURL(userProfile?.photoURL || currentUser?.photoURL || '');
      setBannerURL(userProfile?.bannerURL || '');
      setIsSaved(false);
      setErrorMsg(null);
      setUploadStatusMsg(null);
    }
  }, [isOpen, userProfile, currentUser]);

  if (!isOpen) return null;

  const handleImageFileSelect = async (
    e: React.ChangeEvent<HTMLInputElement>,
    target: 'avatar' | 'banner'
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setErrorMsg(null);
    setUploadStatusMsg(null);
    setUploadingField(target);

    try {
      const result = await uploadImageAsset(file, 'profileImages', (pct) => {
        setUploadStatusMsg(`Uploading ${target === 'avatar' ? 'photo' : 'banner'}: ${pct}%`);
      });

      if (target === 'avatar') {
        setPhotoURL(result.url);
      } else {
        setBannerURL(result.url);
      }
      setUploadStatusMsg(
        result.storage === 'cloud'
          ? `${target === 'avatar' ? 'Profile photo' : 'Banner'} uploaded to cloud storage. Click Save Changes to apply.`
          : `${target === 'avatar' ? 'Profile photo' : 'Banner'} prepared for your local session. Click Save Changes to apply.`
      );
    } catch (err: any) {
      setErrorMsg(err?.message || 'Could not process the selected image.');
    } finally {
      setUploadingField(null);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    try {
      const cleanHandle = handle.trim().startsWith('@')
        ? handle.trim()
        : `@${handle.trim() || displayName.toLowerCase().replace(/[^a-z0-9]/g, '')}`;

      await updateUserProfileData({
        displayName: displayName.trim(),
        handle: cleanHandle,
        bio: bio.trim(),
        photoURL: photoURL.trim() || PRESET_AVATARS[0],
        bannerURL: bannerURL.trim(),
      });
      setIsSaved(true);
      setTimeout(() => {
        setIsSaved(false);
        onClose();
      }, 900);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err?.message || 'Failed to save profile changes.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-2xl border border-[var(--ink-faint)] bg-[var(--surface)] p-5 sm:p-6 shadow-2xl transition-colors max-h-[92vh] overflow-y-auto text-[var(--ink)]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[var(--ink-faint)]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FF0000] text-white">
              <User className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-[var(--ink)] truncate">
                Profile Management
              </h3>
              <p className="text-xs text-[var(--ink-medium)] truncate">
                Update your account identity, creator handle, and profile photo
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[var(--ink-medium)] hover:bg-[var(--ink-faint)] hover:text-[var(--ink)] transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-rose-500/10 p-3 text-xs text-rose-500 border border-rose-500/20 font-semibold">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {uploadStatusMsg && !errorMsg && (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-sky-500/10 p-3 text-xs text-sky-400 border border-sky-500/20 font-medium">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{uploadStatusMsg}</span>
          </div>
        )}

        {isSaved && (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-500/10 p-3 text-xs text-emerald-400 border border-emerald-500/20 font-bold">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>Profile changes saved!</span>
          </div>
        )}

        <form onSubmit={handleSave} className="mt-4 space-y-4">
          {/* Avatar Preview, File Upload & Quick Selector */}
          <div>
            <label className="block text-xs font-bold text-[var(--ink)] mb-2">
              Profile Photo
            </label>
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="relative h-16 w-16 shrink-0">
                <img
                  src={photoURL || PRESET_AVATARS[0]}
                  alt="Avatar preview"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    if (e.currentTarget.src !== PRESET_AVATARS[0]) {
                      e.currentTarget.src = PRESET_AVATARS[0];
                    }
                  }}
                  className="h-16 w-16 rounded-full object-cover ring-2 ring-[#FF0000] shadow-md bg-[var(--bg)]"
                />
                <button
                  type="button"
                  onClick={() => avatarFileInputRef.current?.click()}
                  disabled={uploadingField !== null}
                  title="Choose photo from device"
                  aria-label="Choose photo from device"
                  className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-[#0F0F0F] text-white border border-white/15 shadow-md hover:bg-[#FF0000] hover:text-white transition-colors cursor-pointer"
                >
                  {uploadingField === 'avatar' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Camera className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>

              <div className="flex-1 space-y-2.5 min-w-0">
                <input
                  ref={avatarFileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageFileSelect(e, 'avatar')}
                  className="hidden"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => avatarFileInputRef.current?.click()}
                    disabled={uploadingField !== null}
                    className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border border-[var(--ink-faint)] bg-[var(--bg)] px-3.5 py-2 text-xs font-semibold text-[var(--ink)] hover:border-[#FF0000] transition-colors cursor-pointer"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    <span>{uploadingField === 'avatar' ? 'Uploading...' : 'Choose Photo'}</span>
                  </button>
                  <span className="text-[11px] text-[var(--ink-medium)]">
                    JPG, PNG, WebP (max 5 MB)
                  </span>
                </div>

                <input
                  type="url"
                  placeholder="Or paste image URL..."
                  value={photoURL.startsWith('data:') ? '' : photoURL}
                  onChange={(e) => setPhotoURL(e.target.value)}
                  className="w-full min-h-[42px] rounded-xl border border-[var(--ink-faint)] bg-[var(--bg)] px-3.5 py-2 text-base sm:text-xs text-[var(--ink)] focus:border-[#FF0000] focus:outline-none"
                />

                <div className="space-y-1.5">
                  <span className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-medium)]">
                    Presets
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    {PRESET_AVATARS.map((preset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setPhotoURL(preset)}
                        aria-label={`Select preset avatar ${idx + 1}`}
                        className={`h-9 w-9 rounded-full overflow-hidden ring-2 transition-transform active:scale-95 cursor-pointer ${
                          photoURL === preset ? 'ring-[#FF0000] scale-105' : 'ring-[var(--ink-faint)]'
                        }`}
                      >
                        <img
                          src={preset}
                          alt={`Preset ${idx + 1}`}
                          referrerPolicy="no-referrer"
                          className="h-full w-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[var(--ink)] mb-1">
              Display Name
            </label>
            <input
              type="text"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full min-h-[44px] rounded-xl border border-[var(--ink-faint)] bg-[var(--bg)] px-3.5 py-2 text-base sm:text-xs text-[var(--ink)] focus:border-[#FF0000] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[var(--ink)] mb-1">
              Username Handle
            </label>
            <input
              type="text"
              required
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              className="w-full min-h-[44px] rounded-xl border border-[var(--ink-faint)] bg-[var(--bg)] px-3.5 py-2 text-base sm:text-xs text-[var(--ink)] focus:border-[#FF0000] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[var(--ink)] mb-1">
              Channel Bio
            </label>
            <textarea
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell viewers about your channel..."
              className="w-full rounded-xl border border-[var(--ink-faint)] bg-[var(--bg)] px-3.5 py-2.5 text-base sm:text-xs text-[var(--ink)] focus:border-[#FF0000] focus:outline-none resize-none"
            />
          </div>

          <div>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <label className="block text-xs font-bold text-[var(--ink)]">
                Channel Banner
              </label>
              <button
                type="button"
                onClick={() => bannerFileInputRef.current?.click()}
                disabled={uploadingField !== null}
                className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border border-[var(--ink-faint)] bg-[var(--bg)] px-3 py-1.5 text-xs font-semibold text-[var(--ink)] hover:border-[#FF0000] transition-colors cursor-pointer"
              >
                <ImageIcon className="h-3.5 w-3.5" />
                <span>{uploadingField === 'banner' ? 'Uploading...' : 'Upload Banner Image'}</span>
              </button>
              <input
                ref={bannerFileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => handleImageFileSelect(e, 'banner')}
                className="hidden"
              />
            </div>
            {bannerURL && (
              <div className="mb-2 h-24 w-full overflow-hidden rounded-xl border border-[var(--ink-faint)] bg-[var(--bg)]">
                <img
                  src={bannerURL}
                  alt="Channel banner preview"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    e.currentTarget.style.opacity = '0.35';
                  }}
                  className="h-full w-full object-cover"
                />
              </div>
            )}
            <input
              type="url"
              value={bannerURL.startsWith('data:') ? '' : bannerURL}
              onChange={(e) => setBannerURL(e.target.value)}
              placeholder="Or paste banner image URL..."
              className="w-full min-h-[44px] rounded-xl border border-[var(--ink-faint)] bg-[var(--bg)] px-3.5 py-2 text-base sm:text-xs text-[var(--ink)] focus:border-[#FF0000] focus:outline-none"
            />
          </div>

          <div className="rounded-xl bg-[var(--bg)] border border-[var(--ink-faint)] p-3 text-xs text-[var(--ink-medium)]">
            <span className="font-semibold text-[var(--ink)]">Account Email:</span>{' '}
            <span className="font-mono break-all">{currentUser?.email || 'creator@vio.stream'}</span>
          </div>

          <div className="pt-3 border-t border-[var(--ink-faint)] flex flex-col-reverse sm:flex-row sm:items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] rounded-xl px-4 py-2 text-xs font-bold text-[var(--ink-medium)] hover:bg-[var(--ink-faint)] hover:text-[var(--ink)] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || uploadingField !== null}
              className="min-h-[44px] flex items-center justify-center gap-1.5 rounded-xl bg-[#FF0000] px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[#CC0000] active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
            >
              <Save className="h-4 w-4" />
              <span>{loading ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
