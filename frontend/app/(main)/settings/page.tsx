'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { CheckCircle2, Mail, Calendar, FileText, MessageSquare, Plus, Lock, Upload } from 'lucide-react'
import { cn } from '@/lib/utils'

const defaultTeam = [
  { name: 'Srishti Bankar', email: 'srishti@acme.com', role: 'CEO', avatar: 'SB' },
  { name: 'Marcus Chen', email: 'marcus@acme.com', role: 'Analyst', avatar: 'MC' },
  { name: 'Nina Kowalski', email: 'nina@acme.com', role: 'VP CS', avatar: 'NK' },
  { name: 'Derek Okafor', email: 'derek@acme.com', role: 'Manager', avatar: 'DO' },
  { name: 'James Park', email: 'james@acme.com', role: 'Viewer', avatar: 'JP' },
]

const roleColors: Record<string, string> = {
  Owner: 'bg-indigo-50 text-indigo-600 border-indigo-200',
  CEO: 'bg-indigo-50 text-indigo-600 border-indigo-200',
  Admin: 'bg-purple-50 text-purple-600 border-purple-200',
  Analyst: 'bg-blue-50 text-blue-600 border-blue-200',
  'VP CS': 'bg-green-50 text-green-600 border-green-200',
  Manager: 'bg-amber-50 text-amber-600 border-amber-200',
  Viewer: 'bg-gray-100 text-gray-500 border-gray-200',
}

const notifications = [
  { id: 'pending_approval', label: 'Pending Approvals', desc: 'Get notified when actions need your approval' },
  { id: 'action_complete', label: 'Completed Actions', desc: 'Get notified when AI actions finish' },
  { id: 'risk_alerts', label: 'New Risk Alerts', desc: 'Get notified of new risks identified' },
  { id: 'weekly_digest', label: 'Weekly Digest Email', desc: 'Receive a summary each week' },
  { id: 'morning_brief', label: 'Daily Morning Brief', desc: 'Get your daily executive brief' },
  { id: 'team_mentions', label: 'Team Mention Alerts', desc: 'Get notified when your team is mentioned' },
]

export default function SettingsPage() {
  const [notifStates, setNotifStates] = useState<Record<string, boolean>>({
    pending_approval: true,
    action_complete: true,
    risk_alerts: true,
    weekly_digest: false,
    morning_brief: true,
    team_mentions: false,
  })
  const [showSaveSuccess, setShowSaveSuccess] = useState(false)
  const [teamMembers, setTeamMembers] = useState(defaultTeam)
  const [inviteModalOpen, setInviteModalOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('Viewer')
  const [selectedMemberForRoleChange, setSelectedMemberForRoleChange] = useState<string | null>(null)
  const [newRole, setNewRole] = useState('')

  const handleSaveProfile = () => {
    setShowSaveSuccess(true)
    setTimeout(() => setShowSaveSuccess(false), 2000)
  }

  const handleInviteMember = () => {
    if (inviteEmail) {
      const newMember = {
        name: inviteEmail.split('@')[0],
        email: inviteEmail,
        role: inviteRole,
        avatar: inviteEmail.substring(0, 2).toUpperCase(),
      }
      setTeamMembers(prev => [...prev, newMember])
      setInviteEmail('')
      setInviteRole('Viewer')
      setInviteModalOpen(false)
    }
  }

  const handleChangeRole = (email: string) => {
    setTeamMembers(prev =>
      prev.map(m => m.email === email ? { ...m, role: newRole } : m)
    )
    setSelectedMemberForRoleChange(null)
    setNewRole('')
  }

  const handleRemoveMember = (email: string) => {
    setTeamMembers(prev => prev.filter(m => m.email !== email))
  }

  return (
    <div className="max-w-[900px] mx-auto">
      <PageHeader title="Settings" description="Manage your organization and workspace preferences" />

      <Tabs defaultValue="profile">
        <TabsList className="bg-gray-50 border border-[#e8e8ef] mb-6">
          <TabsTrigger value="profile" className="text-xs">Profile</TabsTrigger>
          <TabsTrigger value="organization" className="text-xs">Organization</TabsTrigger>
          <TabsTrigger value="notifications" className="text-xs">Notifications</TabsTrigger>
          <TabsTrigger value="team" className="text-xs">Team</TabsTrigger>
          <TabsTrigger value="api" className="text-xs">API Keys</TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-6">
          <div className="rounded-xl border border-[#e8e8ef] bg-white shadow-sm p-5">
            <h3 className="text-sm font-medium text-gray-900 mb-4">Profile</h3>
            <div className="space-y-4">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center text-sm font-semibold text-indigo-600">
                  SB
                </div>
                <Button size="sm" variant="outline" className="h-7 text-xs border-[#e8e8ef] text-gray-600">
                  <Upload className="w-2.5 h-2.5 mr-1" /> Change Photo
                </Button>
              </div>
              <div>
                <Label className="text-xs text-gray-500 mb-1.5 block">Full Name</Label>
                <Input defaultValue="Srishti Bankar" className="bg-white border-[#e8e8ef] text-gray-800 max-w-sm" />
              </div>
              <div>
                <Label className="text-xs text-gray-500 mb-1.5 block">Email</Label>
                <Input defaultValue="sbankar@gofundme.com" disabled className="bg-gray-50 border-[#e8e8ef] text-gray-500 max-w-sm" />
              </div>
              <div>
                <Label className="text-xs text-gray-500 mb-1.5 block">Role</Label>
                <div className="flex items-center gap-2 max-w-sm">
                  <Badge className="bg-indigo-50 text-indigo-600 border-indigo-200">CEO</Badge>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-[#e8e8ef] bg-white shadow-sm p-5">
            <h3 className="text-sm font-medium text-gray-900 mb-4">Password</h3>
            <div className="space-y-3 max-w-sm">
              <div>
                <Label className="text-xs text-gray-500 mb-1.5 block">Current Password</Label>
                <Input type="password" className="bg-white border-[#e8e8ef] text-gray-800" />
              </div>
              <div>
                <Label className="text-xs text-gray-500 mb-1.5 block">New Password</Label>
                <Input type="password" className="bg-white border-[#e8e8ef] text-gray-800" />
              </div>
              <div>
                <Label className="text-xs text-gray-500 mb-1.5 block">Confirm Password</Label>
                <Input type="password" className="bg-white border-[#e8e8ef] text-gray-800" />
              </div>
            </div>
            <Button size="sm" className="mt-4 bg-indigo-500 hover:bg-indigo-600 text-xs h-7">
              Update Password
            </Button>
          </div>

          <Button size="sm" className="bg-indigo-500 hover:bg-indigo-600 text-xs h-7" onClick={handleSaveProfile}>
            Save Changes
          </Button>
          {showSaveSuccess && (
            <div className="text-xs text-green-600">
              <CheckCircle2 className="w-3 h-3 inline mr-1" /> Changes saved
            </div>
          )}
        </TabsContent>

        {/* Organization Tab */}
        <TabsContent value="organization" className="space-y-4">
          <div className="rounded-xl border border-[#e8e8ef] bg-white shadow-sm p-5">
            <h3 className="text-sm font-medium text-gray-900 mb-4">Organization Settings</h3>
            <div className="space-y-4">
              <div>
                <Label className="text-xs text-gray-500 mb-1.5 block">Organization Name</Label>
                <Input defaultValue="Acme Corp" className="bg-white border-[#e8e8ef] text-gray-800 max-w-sm" />
              </div>
              <div>
                <Label className="text-xs text-gray-500 mb-1.5 block">Logo</Label>
                <div className="w-24 h-24 rounded-lg border border-[#e8e8ef] bg-gray-50 flex items-center justify-center mb-2">
                  <FileText className="w-8 h-8 text-gray-300" />
                </div>
                <Button size="sm" variant="outline" className="h-7 text-xs border-[#e8e8ef] text-gray-600">
                  <Upload className="w-2.5 h-2.5 mr-1" /> Upload Logo
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-4 max-w-sm">
                <div>
                  <Label className="text-xs text-gray-500 mb-1.5 block">Timezone</Label>
                  <Select defaultValue="utc">
                    <SelectTrigger className="bg-white border-[#e8e8ef] text-gray-700 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="utc">UTC</SelectItem>
                      <SelectItem value="pt">US/Pacific</SelectItem>
                      <SelectItem value="et">US/Eastern</SelectItem>
                      <SelectItem value="london">Europe/London</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-gray-500 mb-1.5 block">Currency</Label>
                  <Select defaultValue="usd">
                    <SelectTrigger className="bg-white border-[#e8e8ef] text-gray-700 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="usd">USD</SelectItem>
                      <SelectItem value="eur">EUR</SelectItem>
                      <SelectItem value="gbp">GBP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <Button size="sm" className="mt-5 bg-indigo-500 hover:bg-indigo-600 text-xs h-7">
              Save
            </Button>
          </div>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="space-y-3">
          <div className="rounded-xl border border-[#e8e8ef] bg-white shadow-sm p-4">
            <h3 className="text-sm font-medium text-gray-900 mb-4">Notification Preferences</h3>
            <div className="space-y-4">
              {notifications.map(notif => (
                <div key={notif.id} className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <p className="text-sm text-gray-800">{notif.label}</p>
                    <p className="text-xs text-gray-400">{notif.desc}</p>
                  </div>
                  <Switch
                    checked={notifStates[notif.id]}
                    onCheckedChange={v => setNotifStates(prev => ({ ...prev, [notif.id]: v }))}
                  />
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* Team Tab */}
        <TabsContent value="team" className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" className="h-7 text-xs bg-indigo-500 hover:bg-indigo-600 gap-1" onClick={() => setInviteModalOpen(true)}>
              <Plus className="w-3.5 h-3.5" /> Invite Member
            </Button>
          </div>
          <div className="rounded-xl border border-[#e8e8ef] bg-white shadow-sm overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#e8e8ef]">
                  {['Avatar', 'Name', 'Email', 'Role', 'Joined', 'Actions'].map(h => (
                    <th key={h} className="text-left text-xs text-gray-500 font-medium px-3 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {teamMembers.map(member => (
                  <tr key={member.email} className="border-b border-[#e8e8ef] hover:bg-gray-50">
                    <td className="px-3 py-3">
                      <div className="w-6 h-6 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center text-[10px] font-medium text-indigo-600">
                        {member.avatar}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-xs font-medium text-gray-800">{member.name}</td>
                    <td className="px-3 py-3 text-xs text-gray-500">{member.email}</td>
                    <td className="px-3 py-3">
                      <Badge className={cn('text-[10px]', roleColors[member.role] || 'bg-gray-100 text-gray-500')}>{member.role}</Badge>
                    </td>
                    <td className="px-3 py-3 text-xs text-gray-500">Apr 2024</td>
                    <td className="px-3 py-3 flex gap-1.5">
                      {member.role !== 'CEO' && (
                        <>
                          <button
                            onClick={() => {
                              setSelectedMemberForRoleChange(member.email)
                              setNewRole(member.role)
                            }}
                            className="text-[10px] text-indigo-600 hover:text-indigo-700 transition-colors"
                          >
                            Change Role
                          </button>
                          <button
                            onClick={() => handleRemoveMember(member.email)}
                            className="text-[10px] text-red-600 hover:text-red-700 transition-colors"
                          >
                            Remove
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* API Keys Tab */}
        <TabsContent value="api">
          <div className="rounded-xl border border-[#e8e8ef] bg-indigo-50 shadow-sm p-8 text-center">
            <Lock className="w-12 h-12 text-indigo-300 mx-auto mb-3" />
            <h3 className="text-sm font-medium text-gray-900 mb-1">Coming in v2</h3>
            <p className="text-xs text-gray-600 max-w-sm mx-auto">
              API access will allow you to integrate StratIQ with your internal tools and data pipelines.
            </p>
          </div>
        </TabsContent>
      </Tabs>

      {/* Invite Member Modal */}
      <Dialog open={inviteModalOpen} onOpenChange={setInviteModalOpen}>
        <DialogContent className="max-w-sm border-[#e8e8ef]">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Invite Member</h2>
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-gray-500 mb-1.5 block">Email Address</Label>
              <Input
                placeholder="name@company.com"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                className="bg-white border-[#e8e8ef] text-gray-800 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs text-gray-500 mb-1.5 block">Role</Label>
              <Select value={inviteRole} onValueChange={(val: string | null) => val && setInviteRole(val)}>
                <SelectTrigger className="bg-white border-[#e8e8ef] text-gray-700 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Analyst">Analyst</SelectItem>
                  <SelectItem value="Manager">Manager</SelectItem>
                  <SelectItem value="Viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2 mt-5">
            <Button variant="outline" className="flex-1 border-[#e8e8ef] text-gray-600 text-sm h-8" onClick={() => setInviteModalOpen(false)}>
              Cancel
            </Button>
            <Button className="flex-1 bg-indigo-500 hover:bg-indigo-600 text-sm h-8" onClick={handleInviteMember}>
              Send Invite
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Change Role Modal */}
      <Dialog open={selectedMemberForRoleChange !== null} onOpenChange={() => setSelectedMemberForRoleChange(null)}>
        <DialogContent className="max-w-sm border-[#e8e8ef]">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Change Role</h2>
          <div>
            <Label className="text-xs text-gray-500 mb-1.5 block">Select New Role</Label>
            <Select value={newRole} onValueChange={(val: string | null) => val && setNewRole(val)}>
              <SelectTrigger className="bg-white border-[#e8e8ef] text-gray-700 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Analyst">Analyst</SelectItem>
                <SelectItem value="Manager">Manager</SelectItem>
                <SelectItem value="Viewer">Viewer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2 mt-5">
            <Button variant="outline" className="flex-1 border-[#e8e8ef] text-gray-600 text-sm h-8" onClick={() => setSelectedMemberForRoleChange(null)}>
              Cancel
            </Button>
            <Button
              className="flex-1 bg-indigo-500 hover:bg-indigo-600 text-sm h-8"
              onClick={() => handleChangeRole(selectedMemberForRoleChange!)}
            >
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
