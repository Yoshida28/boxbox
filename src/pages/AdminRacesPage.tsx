import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const emptyRace = {
  grand_prix_name: '',
  circuit_name: '',
  date: '',
  winner: '',
  podium: '',
  notable_moments: '',
  track_layout_image_url: '',
  video_url: '',
  thumbnail_url: '',
  youtube_video_id: '',
};

export default function AdminRacesPage() {
  const [races, setRaces] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingRace, setEditingRace] = useState(null);
  const [form, setForm] = useState(emptyRace);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchRaces();
  }, []);

  async function fetchRaces() {
    setLoading(true);
    let query = supabase.from('races').select('*').order('date', { ascending: false });
    if (search) {
      query = query.ilike('grand_prix_name', `%${search}%`);
    }
    const { data, error } = await query;
    if (error) setMessage('Error loading races: ' + error.message);
    setRaces(data || []);
    setLoading(false);
  }

  function handleEdit(race) {
    setEditingRace(race.id);
    setForm({ ...race, podium: (race.podium || []).join(', ') });
  }

  function handleCancel() {
    setEditingRace(null);
    setForm(emptyRace);
  }

  async function handleSave(e) {
    e.preventDefault();
    setLoading(true);
    const payload = {
      ...form,
      podium: form.podium.split(',').map(s => s.trim()).filter(Boolean),
    };
    let res;
    if (editingRace) {
      res = await supabase.from('races').update(payload).eq('id', editingRace);
    } else {
      res = await supabase.from('races').insert([payload]);
    }
    if (res.error) setMessage('Error saving: ' + res.error.message);
    else setMessage('Saved!');
    setEditingRace(null);
    setForm(emptyRace);
    fetchRaces();
    setLoading(false);
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this race?')) return;
    setLoading(true);
    const { error } = await supabase.from('races').delete().eq('id', id);
    if (error) setMessage('Error deleting: ' + error.message);
    else setMessage('Deleted!');
    fetchRaces();
    setLoading(false);
  }

  async function handleClear(id) {
    setLoading(true);
    const { error } = await supabase.from('races').update({ youtube_video_id: null, thumbnail_url: null, video_url: null }).eq('id', id);
    if (error) setMessage('Error clearing: ' + error.message);
    else setMessage('Cleared!');
    fetchRaces();
    setLoading(false);
  }

  function handleChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Admin: Manage Races</h1>
        <div className="mb-4 flex gap-2">
          <input
            className="bg-gray-800 text-white px-4 py-2 rounded"
            placeholder="Search by Grand Prix name"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <button className="bg-blue-600 px-4 py-2 rounded" onClick={fetchRaces} disabled={loading}>Search</button>
        </div>
        {message && <div className="mb-4 text-green-400">{message}</div>}
        <form onSubmit={handleSave} className="bg-gray-800 p-4 rounded mb-8">
          <h2 className="text-xl font-semibold mb-2">{editingRace ? 'Edit Race' : 'Create New Race'}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input name="grand_prix_name" value={form.grand_prix_name} onChange={handleChange} placeholder="Grand Prix Name" className="bg-gray-700 p-2 rounded" required />
            <input name="circuit_name" value={form.circuit_name} onChange={handleChange} placeholder="Circuit Name" className="bg-gray-700 p-2 rounded" required />
            <input name="date" value={form.date} onChange={handleChange} placeholder="Date (YYYY-MM-DD)" className="bg-gray-700 p-2 rounded" required />
            <input name="winner" value={form.winner} onChange={handleChange} placeholder="Winner" className="bg-gray-700 p-2 rounded" required />
            <input name="podium" value={form.podium} onChange={handleChange} placeholder="Podium (comma separated)" className="bg-gray-700 p-2 rounded" />
            <input name="notable_moments" value={form.notable_moments} onChange={handleChange} placeholder="Notable Moments" className="bg-gray-700 p-2 rounded" />
            <input name="track_layout_image_url" value={form.track_layout_image_url} onChange={handleChange} placeholder="Track Layout Image URL" className="bg-gray-700 p-2 rounded" />
            <input name="video_url" value={form.video_url} onChange={handleChange} placeholder="Video URL" className="bg-gray-700 p-2 rounded" />
            <input name="thumbnail_url" value={form.thumbnail_url} onChange={handleChange} placeholder="Thumbnail URL" className="bg-gray-700 p-2 rounded" />
            <input name="youtube_video_id" value={form.youtube_video_id} onChange={handleChange} placeholder="YouTube Video ID" className="bg-gray-700 p-2 rounded" />
          </div>
          <div className="mt-4 flex gap-2">
            <button type="submit" className="bg-green-600 px-4 py-2 rounded" disabled={loading}>{editingRace ? 'Save Changes' : 'Create Race'}</button>
            {editingRace && <button type="button" className="bg-gray-600 px-4 py-2 rounded" onClick={handleCancel}>Cancel</button>}
          </div>
        </form>
        <div className="overflow-x-auto">
          <table className="min-w-full bg-gray-800 rounded">
            <thead>
              <tr>
                <th className="p-2">Grand Prix</th>
                <th className="p-2">Date</th>
                <th className="p-2">Winner</th>
                <th className="p-2">YouTube ID</th>
                <th className="p-2">Thumbnail</th>
                <th className="p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {races.map(race => (
                <tr key={race.id} className="border-b border-gray-700">
                  <td className="p-2">{race.grand_prix_name}</td>
                  <td className="p-2">{race.date}</td>
                  <td className="p-2">{race.winner}</td>
                  <td className="p-2">{race.youtube_video_id}</td>
                  <td className="p-2">
                    {race.thumbnail_url && <img src={race.thumbnail_url} alt="thumb" className="w-20 h-12 object-cover rounded" />}
                  </td>
                  <td className="p-2 flex gap-2">
                    <button className="bg-yellow-600 px-2 py-1 rounded" onClick={() => handleEdit(race)}>Edit</button>
                    <button className="bg-red-600 px-2 py-1 rounded" onClick={() => handleDelete(race.id)}>Delete</button>
                    <button className="bg-blue-600 px-2 py-1 rounded" onClick={() => handleClear(race.id)}>Clear</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
} 