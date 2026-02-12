import { Search } from 'lucide-react';

interface UserFiltersProps {
  onSearchChange: (value: string) => void;
  onRoleChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  searchValue: string;
  roleValue: string;
  statusValue: string;
}

export function UserFilters({
  onSearchChange,
  onRoleChange,
  onStatusChange,
  searchValue,
  roleValue,
  statusValue,
}: UserFiltersProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-4 mb-6">
      {/* Search */}
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/60" />
        <input
          type="text"
          placeholder="Search by email or username..."
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-card border border-border rounded-lg text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
        />
      </div>

      {/* Role Filter */}
      <select
        value={roleValue}
        onChange={(e) => onRoleChange(e.target.value)}
        className="px-4 py-3 bg-card border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent cursor-pointer transition-all"
      >
        <option value="">All Roles</option>
        <option value="admin">Admin</option>
        <option value="user">User</option>
        <option value="guest">Guest</option>
      </select>

      {/* Status Filter */}
      <select
        value={statusValue}
        onChange={(e) => onStatusChange(e.target.value)}
        className="px-4 py-3 bg-card border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent cursor-pointer transition-all"
      >
        <option value="">All Status</option>
        <option value="active">Active</option>
        <option value="inactive">Inactive</option>
      </select>
    </div>
  );
}
