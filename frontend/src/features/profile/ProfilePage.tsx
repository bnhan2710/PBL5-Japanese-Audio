import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { profileApi } from './api/profileClient';
import { Camera, Save, User as UserIcon, Loader2 } from 'lucide-react';

export default function ProfilePage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  
  const [formData, setFormData] = useState({
    username: '',
    first_name: '',
    last_name: '',
    avatar_url: ''
  });

  const [passwordData, setPasswordData] = useState({
    old_password: '',
    new_password: '',
    confirm_password: ''
  });

  useEffect(() => {
    if (user) {
      setFormData({
        username: user.username || '',
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        avatar_url: user.avatar_url || ''
      });
    }
  }, [user]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPasswordData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setMessage(null);
    try {
      const { avatar_url } = await profileApi.uploadAvatar(file);
      setFormData(prev => ({ ...prev, avatar_url }));
      setMessage({ type: 'success', text: 'Avatar uploaded successfully' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to upload avatar' });
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      await profileApi.updateProfile(formData);
      setMessage({ type: 'success', text: 'Profile updated successfully' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to update profile' });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordData.new_password !== passwordData.confirm_password) {
      setMessage({ type: 'error', text: 'New passwords do not match' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      await profileApi.changePassword({
        old_password: passwordData.old_password,
        new_password: passwordData.new_password
      });
      setMessage({ type: 'success', text: 'Password changed successfully' });
      setPasswordData({ old_password: '', new_password: '', confirm_password: '' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to change password' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="flex items-center space-x-4 mb-8">
        <UserIcon className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold text-foreground">My Profile</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Avatar Section */}
        <div className="flex flex-col items-center space-y-4">
          <div className="relative group">
            <div className="w-48 h-48 rounded-full overflow-hidden border-4 border-muted flex items-center justify-center bg-accent">
              {formData.avatar_url ? (
                <img src={formData.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <UserIcon className="h-20 w-20 text-muted-foreground" />
              )}
            </div>
            <label className="absolute bottom-2 right-2 p-2 bg-primary text-primary-foreground rounded-full cursor-pointer hover:bg-primary/90 transition-colors shadow-lg">
              {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
              <input type="file" className="hidden" accept="image/*" onChange={handleAvatarChange} disabled={uploading} />
            </label>
          </div>
          <p className="text-sm text-muted-foreground">Click the camera icon to upload a new avatar</p>
        </div>

        {/* Info Section */}
        <div className="md:col-span-2 bg-card rounded-lg border border-border p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-6">
            {message && (
              <div className={`p-4 rounded-md ${message.type === 'success' ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive'}`}>
                {message.text}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Username</label>
                <input 
                  name="username" 
                  value={formData.username} 
                  onChange={handleChange}
                  className="w-full p-2 bg-background border border-input rounded-md focus:ring-2 focus:ring-primary focus:outline-none"
                  placeholder="Username"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Email</label>
                <input 
                  value={user?.email || ''} 
                  disabled
                  className="w-full p-2 bg-muted border border-input rounded-md text-muted-foreground cursor-not-allowed"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">First Name</label>
                <input 
                  name="first_name" 
                  value={formData.first_name} 
                  onChange={handleChange}
                  className="w-full p-2 bg-background border border-input rounded-md focus:ring-2 focus:ring-primary focus:outline-none"
                  placeholder="First name"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Last Name</label>
                <input 
                  name="last_name" 
                  value={formData.last_name} 
                  onChange={handleChange}
                  className="w-full p-2 bg-background border border-input rounded-md focus:ring-2 focus:ring-primary focus:outline-none"
                  placeholder="Last name"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={loading || uploading}
                className="flex items-center space-x-2 bg-primary text-primary-foreground px-6 py-2 rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                <span>Save Changes</span>
              </button>
            </div>
          </form>
        </div>

        {/* Change Password Section */}
        <div className="md:col-span-3 bg-card rounded-lg border border-border p-6 shadow-sm mt-8">
          <h2 className="text-xl font-semibold mb-6 text-foreground">Change Password</h2>
          <form onSubmit={handlePasswordSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Current Password</label>
                <input 
                  type="password"
                  name="old_password"
                  value={passwordData.old_password} 
                  onChange={handlePasswordChange}
                  className="w-full p-2 bg-background border border-input rounded-md focus:ring-2 focus:ring-primary focus:outline-none"
                  placeholder="Current password"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">New Password</label>
                <input 
                  type="password"
                  name="new_password"
                  value={passwordData.new_password} 
                  onChange={handlePasswordChange}
                  className="w-full p-2 bg-background border border-input rounded-md focus:ring-2 focus:ring-primary focus:outline-none"
                  placeholder="New password (min 8 chars)"
                  required
                  minLength={8}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Confirm New Password</label>
                <input 
                  type="password"
                  name="confirm_password"
                  value={passwordData.confirm_password} 
                  onChange={handlePasswordChange}
                  className="w-full p-2 bg-background border border-input rounded-md focus:ring-2 focus:ring-primary focus:outline-none"
                  placeholder="Confirm new password"
                  required
                  minLength={8}
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="flex items-center space-x-2 bg-secondary text-secondary-foreground px-6 py-2 rounded-md hover:bg-secondary/90 transition-colors disabled:opacity-50"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                <span>Update Password</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
