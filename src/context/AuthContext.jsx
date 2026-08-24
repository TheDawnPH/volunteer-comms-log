import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const AuthContext = createContext(null)

/*
 * Login design note
 * ------------------
 * The flowchart's "Login using PIN" screens map onto Supabase Auth like this:
 *  - Every volunteer/admin/staff row in `profiles` has a unique `login_code`
 *    (their badge number or nickname) and a real, hidden email under the hood.
 *  - Signing in takes {login_code, pin}; we resolve login_code -> email via
 *    the `resolve_login_code` RPC (SECURITY DEFINER, read-only) and then call
 *    supabase.auth.signInWithPassword({ email, password: pin }).
 *  - "Forgot PIN" calls supabase.auth.resetPasswordForEmail(email), which
 *    sends Supabase's reset email/link — matching "Send Reset User Account
 *    Email" -> "Reset User Account Link" -> "Reset PIN" in the diagram.
 *  - Role (volunteer / admin) and profile fields live in `profiles`,
 *    protected by the RLS policies in supabase/policies.sql.
 */

const AuthContext_ = AuthContext

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (data.session) loadProfile(data.session.user.id)
      else setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess)
      if (sess) loadProfile(sess.user.id)
      else { setProfile(null); setLoading(false) }
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  async function loadProfile(userId) {
    setLoading(true)
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    if (!error) setProfile(data)
    setLoading(false)
  }

  async function loginWithPin(loginCode, pin) {
    const { data: email, error: resolveErr } = await supabase.rpc('resolve_login_code', {
      code: loginCode.trim()
    })
    if (resolveErr || !email) throw new Error('That badge number / nickname was not found.')

    const { error } = await supabase.auth.signInWithPassword({ email, password: pin })
    if (error) throw new Error('Incorrect PIN. Please try again.')
  }

  async function forgotPin(loginCode) {
    const { data: email, error: resolveErr } = await supabase.rpc('resolve_login_code', {
      code: loginCode.trim()
    })
    if (resolveErr || !email) throw new Error('That badge number / nickname was not found.')
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-pin`
    })
    if (error) throw error
  }

  async function changePin(newPin) {
    const { error } = await supabase.auth.updateUser({ password: newPin })
    if (error) throw error
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  const value = {
    session,
    profile,
    loading,
    isAdmin: profile?.role === 'admin',
    loginWithPin,
    forgotPin,
    changePin,
    signOut,
    refreshProfile: () => session && loadProfile(session.user.id)
  }

  return <AuthContext_.Provider value={value}>{children}</AuthContext_.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
