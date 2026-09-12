import React, { useState } from 'react';
import {
  ShieldAlert,
  Radio,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ChevronDown,
  ArrowRight,
  AlertCircle,
  Loader2,
  CheckCircle2,
  KeyRound,
  MapPin,
  UserCheck
} from 'lucide-react';
import type { OperatorSignupData, AuthorizationRole } from '../types';

export interface OperatorSignupPageProps {
  /**
   * Prop-based submit handler. The component performs client-side validation first
   * and invokes this callback with verified payload.
   */
  onSubmit: (data: OperatorSignupData) => Promise<void>;
  /**
   * External loading state to disable submit and show tactical provisioning spinner
   */
  isLoading?: boolean;
  /**
   * Server-side error message to display in the alert banner
   */
  errorMessage?: string | null;
  /**
   * Navigation callback to switch back to operator sign-in screen
   */
  onNavigateToLogin: () => void;
}

const SECTOR_OPTIONS = [
  { value: '', label: 'Select Assigned Tactical Sector...' },
  { value: 'Sector 1 Alpha', label: 'Sector 1 Alpha — Downtown & Financial Core' },
  { value: 'Sector 2 Bravo', label: 'Sector 2 Bravo — Port & Coastal Marine Basin' },
  { value: 'Sector 3 Charlie', label: 'Sector 3 Charlie — Chemical & Industrial Corridor' },
  { value: 'Sector 4 Delta', label: 'Sector 4 Delta — Riparian Floodplain & Riverbend' },
  { value: 'Sector 5 Echo', label: 'Sector 5 Echo — Highland Ridge & Canyon Evacuation' },
  { value: 'Sector 6 Foxtrot', label: 'Sector 6 Foxtrot — Metro Transit & Highway Bridgehead' },
];

const ROLE_OPTIONS: { value: AuthorizationRole; label: string; clearance: string }[] = [
  { value: 'Dispatcher', label: 'Tactical Dispatcher', clearance: 'Level 1: Field Unit Routing' },
  { value: 'Supervisor', label: 'Operations Supervisor', clearance: 'Level 2: AI Plan Overrides & Hoist Auth' },
  { value: 'Administrator', label: 'Regional Administrator', clearance: 'Level 3: Full Crypt-Chain Mesh Authority' },
];

interface FormErrors {
  callsign?: string;
  email?: string;
  sector?: string;
  role?: string;
  password?: string;
  confirmPassword?: string;
}

export const OperatorSignupPage: React.FC<OperatorSignupPageProps> = ({
  onSubmit,
  isLoading = false,
  errorMessage = null,
  onNavigateToLogin,
}) => {
  const [formData, setFormData] = useState({
    callsign: '',
    email: '',
    sector: '',
    role: 'Dispatcher' as AuthorizationRole,
    password: '',
    confirmPassword: '',
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const validateField = (name: string, value: string): string | undefined => {
    switch (name) {
      case 'callsign':
        if (!value.trim()) return 'Callsign / Badge ID is required';
        if (value.trim().length < 3) return 'Callsign must be at least 3 characters';
        if (!/^[A-Za-z0-9\-_.]+$/.test(value.trim())) {
          return 'Callsign can only contain letters, numbers, hyphens, and dots';
        }
        return undefined;

      case 'email':
        if (!value.trim()) return 'Official operator email is required';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) {
          return 'Please provide a valid tactical or agency email address';
        }
        return undefined;

      case 'sector':
        if (!value) return 'Tactical sector assignment is required';
        return undefined;

      case 'role':
        if (!value) return 'Authorization role is required';
        return undefined;

      case 'password':
        if (!value) return 'Security password is required';
        if (value.length < 8) return 'Password must be at least 8 characters';
        return undefined;

      case 'confirmPassword':
        if (!value) return 'Please confirm your security password';
        if (value !== formData.password) return 'Passwords do not match';
        return undefined;

      default:
        return undefined;
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    if (touched[name]) {
      const fieldError = validateField(name, value);
      setErrors((prev) => ({ ...prev, [name]: fieldError }));

      // Special check: if editing password and confirmPassword was already touched
      if (name === 'password' && touched.confirmPassword) {
        if (formData.confirmPassword && value !== formData.confirmPassword) {
          setErrors((prev) => ({
            ...prev,
            confirmPassword: 'Passwords do not match',
          }));
        } else if (formData.confirmPassword && value === formData.confirmPassword) {
          setErrors((prev) => ({
            ...prev,
            confirmPassword: undefined,
          }));
        }
      }
    }
  };

  const handleBlur = (
    e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
    const fieldError = validateField(name, value);
    setErrors((prev) => ({ ...prev, [name]: fieldError }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Mark all fields touched
    const allTouched = {
      callsign: true,
      email: true,
      sector: true,
      role: true,
      password: true,
      confirmPassword: true,
    };
    setTouched(allTouched);

    // Validate all fields
    const formValidationErrors: FormErrors = {
      callsign: validateField('callsign', formData.callsign),
      email: validateField('email', formData.email),
      sector: validateField('sector', formData.sector),
      role: validateField('role', formData.role),
      password: validateField('password', formData.password),
      confirmPassword: validateField('confirmPassword', formData.confirmPassword),
    };

    setErrors(formValidationErrors);

    const hasErrors = Object.values(formValidationErrors).some(
      (err) => err !== undefined
    );

    if (!hasErrors) {
      await onSubmit({
        callsign: formData.callsign.trim().toUpperCase(),
        email: formData.email.trim(),
        sector: formData.sector,
        role: formData.role,
        password: formData.password,
      });
    }
  };

  return (
    <div
      id="operator-signup-page"
      className="min-h-screen w-full bg-surface flex flex-col justify-center items-center p-4 sm:p-6 lg:p-8 relative overflow-hidden"
    >
      {/* Background Synthetic Vector Grid Accent */}
      <div
        className="absolute inset-0 bg-[radial-gradient(#242a38_1px,transparent_1px)] [background-size:32px_32px] pointer-events-none opacity-30"
        aria-hidden="true"
      />

      {/* Atmospheric Ambient Glows */}
      <div
        className="absolute top-1/4 -left-48 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none"
        aria-hidden="true"
      />
      <div
        className="absolute bottom-1/4 -right-48 w-96 h-96 bg-secondary/10 rounded-full blur-3xl pointer-events-none"
        aria-hidden="true"
      />

      {/* Main Form Container Card */}
      <div className="w-full max-w-xl z-10 flex flex-col gap-4">
        {/* Brand & Node Header Bar */}
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-2.5">
            <div className="w-3 h-3 rounded-full bg-primary animate-pulse" />
            <div className="flex flex-col">
              <span className="font-label-action uppercase tracking-widest text-on-surface text-sm">
                DisasterLink Core
              </span>
              <span className="font-mono-data-sm text-outline text-[11px]">
                NODE ID: HQ-NORTH-01 // TAC-ENROLL
              </span>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-2 px-2 py-1 rounded bg-surface-container-low border border-outline-variant/40 font-mono-data-sm text-[11px]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="text-outline">GRID:</span>
            <span className="text-primary font-bold">SECURE // SYNCED</span>
          </div>
        </div>

        {/* Tactical Card */}
        <div className="bg-surface-container rounded-lg border border-outline-variant/50 shadow-2xl p-6 sm:p-8 relative overflow-hidden backdrop-blur-sm">
          {/* Top Edge Red/Cyan Accent Line */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-tertiary to-secondary" />

          {/* Form Header */}
          <div className="mb-6">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-1.5">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-primary" />
                <h1 className="font-headline-sm text-lg sm:text-xl font-bold text-on-surface tracking-tight">
                  Operator Authorization &amp; Signup
                </h1>
              </div>
              <span className="px-2 py-0.5 rounded bg-error-container text-on-error-container font-mono-data-sm text-[10px] font-bold tracking-wider">
                DEFCON L2 AUTH
              </span>
            </div>
            <p className="text-on-surface-variant text-xs sm:text-sm">
              Enroll credentials into the Tactical Dispatch Network for multi-casualty incident triage.
            </p>
          </div>

          {/* Server-Side Error Banner */}
          {errorMessage && (
            <div
              id="signup-server-error-banner"
              className="mb-5 p-3 rounded bg-error-container/40 border border-error/50 text-on-error-container flex items-start gap-2.5 text-xs sm:text-sm animate-shake"
              role="alert"
            >
              <AlertCircle className="w-4 h-4 text-error shrink-0 mt-0.5" />
              <div className="flex flex-col">
                <span className="font-mono text-[11px] font-bold text-error uppercase tracking-wider">
                  AUTHORIZATION REJECTED
                </span>
                <span className="mt-0.5 text-on-surface">{errorMessage}</span>
              </div>
            </div>
          )}

          {/* Registration Form */}
          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
            {/* Callsign / Badge ID */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="callsign"
                className="font-label-action text-xs text-on-surface flex items-center justify-between"
              >
                <span className="flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5 text-secondary" />
                  CALLSIGN / BADGE ID <span className="text-primary">*</span>
                </span>
                <span className="font-mono-data-sm text-[10px] text-outline">TAC-ID FORMAT</span>
              </label>
              <div className="relative">
                <input
                  id="callsign"
                  name="callsign"
                  type="text"
                  value={formData.callsign}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  disabled={isLoading}
                  placeholder="e.g. CDR-VANCE or TAC-DISPATCH-09"
                  className={`w-full bg-surface-container-low text-on-surface font-mono text-sm px-3 py-2.5 rounded border transition-colors placeholder:text-outline/60 focus:outline-none focus:ring-1 ${
                    touched.callsign && errors.callsign
                      ? 'border-error focus:border-error focus:ring-error'
                      : 'border-outline-variant/60 focus:border-secondary focus:ring-secondary'
                  } disabled:opacity-50`}
                />
              </div>
              {touched.callsign && errors.callsign && (
                <p id="callsign-error" className="font-mono text-[11px] text-error flex items-center gap-1 mt-0.5">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  {errors.callsign}
                </p>
              )}
            </div>

            {/* Email Address */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="email"
                className="font-label-action text-xs text-on-surface flex items-center justify-between"
              >
                <span className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-secondary" />
                  OFFICIAL AGENCY EMAIL <span className="text-primary">*</span>
                </span>
                <span className="font-mono-data-sm text-[10px] text-outline">MEMBER PDU ROUTING</span>
              </label>
              <div className="relative">
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  disabled={isLoading}
                  placeholder="operator.callsign@disasterlink.gov"
                  className={`w-full bg-surface-container-low text-on-surface text-sm px-3 py-2.5 rounded border transition-colors placeholder:text-outline/60 focus:outline-none focus:ring-1 ${
                    touched.email && errors.email
                      ? 'border-error focus:border-error focus:ring-error'
                      : 'border-outline-variant/60 focus:border-secondary focus:ring-secondary'
                  } disabled:opacity-50`}
                />
              </div>
              {touched.email && errors.email && (
                <p id="email-error" className="font-mono text-[11px] text-error flex items-center gap-1 mt-0.5">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  {errors.email}
                </p>
              )}
            </div>

            {/* Sector & Role Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Tactical Sector Dropdown */}
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="sector"
                  className="font-label-action text-xs text-on-surface flex items-center gap-1.5"
                >
                  <MapPin className="w-3.5 h-3.5 text-tertiary" />
                  ASSIGNED SECTOR <span className="text-primary">*</span>
                </label>
                <div className="relative">
                  <select
                    id="sector"
                    name="sector"
                    value={formData.sector}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    disabled={isLoading}
                    className={`w-full bg-surface-container-low text-on-surface text-xs sm:text-sm pl-3 pr-8 py-2.5 rounded border appearance-none transition-colors focus:outline-none focus:ring-1 ${
                      touched.sector && errors.sector
                        ? 'border-error focus:border-error focus:ring-error'
                        : 'border-outline-variant/60 focus:border-secondary focus:ring-secondary'
                    } disabled:opacity-50`}
                  >
                    {SECTOR_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value} className="bg-surface-container text-on-surface py-1">
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-outline absolute right-2.5 top-3 pointer-events-none" />
                </div>
                {touched.sector && errors.sector && (
                  <p id="sector-error" className="font-mono text-[11px] text-error flex items-center gap-1 mt-0.5">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    {errors.sector}
                  </p>
                )}
              </div>

              {/* Authorization Role Dropdown */}
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="role"
                  className="font-label-action text-xs text-on-surface flex items-center gap-1.5"
                >
                  <UserCheck className="w-3.5 h-3.5 text-secondary" />
                  AUTHORIZATION ROLE <span className="text-primary">*</span>
                </label>
                <div className="relative">
                  <select
                    id="role"
                    name="role"
                    value={formData.role}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    disabled={isLoading}
                    className={`w-full bg-surface-container-low text-on-surface text-xs sm:text-sm pl-3 pr-8 py-2.5 rounded border appearance-none transition-colors focus:outline-none focus:ring-1 ${
                      touched.role && errors.role
                        ? 'border-error focus:border-error focus:ring-error'
                        : 'border-outline-variant/60 focus:border-secondary focus:ring-secondary'
                    } disabled:opacity-50`}
                  >
                    {ROLE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value} className="bg-surface-container text-on-surface py-1">
                        {opt.label} ({opt.value})
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-outline absolute right-2.5 top-3 pointer-events-none" />
                </div>
                {touched.role && errors.role && (
                  <p id="role-error" className="font-mono text-[11px] text-error flex items-center gap-1 mt-0.5">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    {errors.role}
                  </p>
                )}
              </div>
            </div>

            {/* Passwords: Password and Confirm Password */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Password */}
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="password"
                  className="font-label-action text-xs text-on-surface flex items-center gap-1.5"
                >
                  <Lock className="w-3.5 h-3.5 text-primary" />
                  PASSWORD <span className="text-primary">*</span>
                </label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    disabled={isLoading}
                    placeholder="Min 8 characters"
                    className={`w-full bg-surface-container-low text-on-surface text-sm pl-3 pr-10 py-2.5 rounded border transition-colors placeholder:text-outline/60 focus:outline-none focus:ring-1 ${
                      touched.password && errors.password
                        ? 'border-error focus:border-error focus:ring-error'
                        : 'border-outline-variant/60 focus:border-secondary focus:ring-secondary'
                    } disabled:opacity-50`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    className="absolute right-2.5 top-2.5 text-outline hover:text-on-surface transition-colors p-1"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {touched.password && errors.password ? (
                  <p id="password-error" className="font-mono text-[11px] text-error flex items-center gap-1 mt-0.5">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    {errors.password}
                  </p>
                ) : (
                  <span className="font-mono-data-sm text-[10px] text-outline">Minimum 8 alphanumeric characters</span>
                )}
              </div>

              {/* Confirm Password */}
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="confirmPassword"
                  className="font-label-action text-xs text-on-surface flex items-center gap-1.5"
                >
                  <KeyRound className="w-3.5 h-3.5 text-primary" />
                  CONFIRM PASSWORD <span className="text-primary">*</span>
                </label>
                <div className="relative">
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    disabled={isLoading}
                    placeholder="Re-type password"
                    className={`w-full bg-surface-container-low text-on-surface text-sm pl-3 pr-10 py-2.5 rounded border transition-colors placeholder:text-outline/60 focus:outline-none focus:ring-1 ${
                      touched.confirmPassword && errors.confirmPassword
                        ? 'border-error focus:border-error focus:ring-error'
                        : 'border-outline-variant/60 focus:border-secondary focus:ring-secondary'
                    } disabled:opacity-50`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    tabIndex={-1}
                    className="absolute right-2.5 top-2.5 text-outline hover:text-on-surface transition-colors p-1"
                    aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {touched.confirmPassword && errors.confirmPassword && (
                  <p id="confirm-password-error" className="font-mono text-[11px] text-error flex items-center gap-1 mt-0.5">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    {errors.confirmPassword}
                  </p>
                )}
              </div>
            </div>

            {/* Cryptographic Mesh Security Badge */}
            <div className="mt-1 p-2.5 rounded bg-surface-container-lowest/80 border border-outline-variant/30 flex items-center justify-between text-[11px] font-mono text-outline">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-secondary shrink-0" />
                <span>ECDSA P-256 / SHA-256 SIGNING</span>
              </span>
              <span className="text-secondary font-bold">AIR-GAP SYNC READY</span>
            </div>

            {/* Submit Button */}
            <button
              id="signup-submit-btn"
              type="submit"
              disabled={isLoading}
              className={`w-full mt-2 py-3 px-4 rounded font-label-action text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg transition-all active:scale-[0.99] ${
                isLoading
                  ? 'bg-secondary-container/40 text-on-secondary/50 cursor-not-allowed'
                  : 'bg-secondary-container hover:bg-secondary-container/90 text-on-secondary-container shadow-secondary-container/30'
              }`}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-secondary" />
                  <span>PROVISIONING CREDENTIALS...</span>
                </>
              ) : (
                <>
                  <span>INITIALIZE OPERATOR AUTHORIZATION</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Footer with onNavigateToLogin callback */}
          <div className="mt-6 pt-4 border-t border-outline-variant/30 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
            <span className="text-on-surface-variant">Already an authorized tactical dispatcher?</span>
            <button
              id="navigate-to-login-btn"
              type="button"
              onClick={onNavigateToLogin}
              className="text-secondary hover:text-white font-bold font-label-action flex items-center gap-1 transition-colors underline underline-offset-4"
            >
              <span>Sign in here</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Tactical compliance footer */}
        <div className="flex items-center justify-between px-2 text-[10px] font-mono text-outline">
          <span>DISASTERLINK PROTOCOL v4.2.1-TAC</span>
          <span>UNAUTHORIZED DISPATCH ENTRY STRICTLY PROHIBITED</span>
        </div>
      </div>
    </div>
  );
};

export default OperatorSignupPage;
