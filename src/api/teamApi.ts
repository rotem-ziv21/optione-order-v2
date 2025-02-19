import { supabase } from '../lib/supabase';

export async function getTeamByBusinessId(businessId: string) {
  const { data, error } = await supabase
    .from('team')
    .select('*')
    .eq('business_id', businessId);

  if (error) {
    console.error('Error fetching team:', error);
    return [];
  }

  return data;
}

export async function addTeamMember(businessId: string, name: string) {
  const { data, error } = await supabase
    .from('team')
    .insert({
      business_id: businessId,
      name,
    });

  if (error) {
    console.error('Error adding team member:', error);
    return null;
  }

  return data;
}
