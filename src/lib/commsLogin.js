/**
 * Shared "Comms Login/Logout" logic (see Volunteer_System.png):
 *   Is timed IN? -> yes: Time OUT + Release Headset
 *                -> no:  Is the headset free? -> yes: Time IN + Lock Headset
 *                                              -> no:  Error, used by another person
 *
 * Used by both:
 *  - src/pages/CommsLogin.jsx      — a signed-in volunteer/admin acting
 *    for themselves (identity = { type: 'profile', profileId }).
 *  - src/components/GuestCommsLogin.jsx — an admin acting on behalf of
 *    a guest who isn't in the system (identity = { type: 'guest',
 *    guestName, createdBy }). Guests are matched by name only, so keep
 *    names distinct if two guests could plausibly share one.
 */

export async function lookupEquipment(supabase, rawValue) {
  const value = (rawValue || '').trim()
  if (!value) throw new Error('Enter or scan a headset QR value or name.')

  const { data: byQr } = await supabase.from('comms_equipment').select('*').eq('qr_value', value).maybeSingle()
  if (byQr) return byQr

  const { data: byName } = await supabase.from('comms_equipment').select('*').ilike('name', value).maybeSingle()
  if (byName) return byName

  throw new Error('Unrecognized QR code / headset name.')
}

function identityMatch(query, identity) {
  if (identity.type === 'profile') return query.eq('profile_id', identity.profileId)
  return query.is('profile_id', null).ilike('guest_name', identity.guestName.trim())
}

export async function toggleCommsLog(supabase, equipment, identity) {
  // Already timed in on this headset under this identity? -> Time OUT.
  const myOpenQuery = identityMatch(
    supabase.from('comms_logs').select('*').eq('equipment_id', equipment.id).eq('status', 'in'),
    identity
  )
  const { data: myOpen } = await myOpenQuery.maybeSingle()

  if (myOpen) {
    await supabase.from('comms_logs').update({ time_out: new Date().toISOString(), status: 'out' }).eq('id', myOpen.id)
    await supabase.from('comms_equipment').update({ status: 'available' }).eq('id', equipment.id)
    return { action: 'out' }
  }

  // Is the headset free (nobody — registered or guest — has it open)?
  const { data: otherOpen } = await supabase
    .from('comms_logs').select('id').eq('equipment_id', equipment.id).eq('status', 'in').maybeSingle()
  if (otherOpen) {
    throw new Error('Headset is used by another volunteer. Ask them to time out first.')
  }

  const insertRow = { equipment_id: equipment.id, status: 'in' }
  if (identity.type === 'profile') {
    insertRow.profile_id = identity.profileId
  } else {
    insertRow.guest_name = identity.guestName.trim()
    insertRow.guest_created_by = identity.createdBy
  }
  const { error } = await supabase.from('comms_logs').insert(insertRow)
  if (error) throw error
  await supabase.from('comms_equipment').update({ status: 'in_use' }).eq('id', equipment.id)
  return { action: 'in' }
}
