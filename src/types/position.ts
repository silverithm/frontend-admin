export interface Position {
    id: number;
    companyId: number;
    name: string;
    description?: string;
    memberRole?: 'caregiver' | 'office' | null;
    sortOrder: number;
    createdAt?: string;
    updatedAt?: string;
}
