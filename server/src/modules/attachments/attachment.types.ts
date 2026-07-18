export type StorageProvider = 'local' | 's3';
export type AttachmentBusinessType =
  'hazard' | 'emergency_event' | 'emergency_plan' | 'event_review' | 'drill';

export interface StoredObject {
  id: string;
  storageKey: string;
  provider: StorageProvider;
  bucket?: string;
  originalName: string;
  contentType: string;
  size: number;
  sha256: string;
  uploaderId: string;
  uploader: string;
  areaId: string;
  businessType?: AttachmentBusinessType;
  businessId?: string;
  status: 'uploaded' | 'bound';
  createdAt: string;
  boundAt?: string;
}

export interface AttachmentAccess {
  actorId: string;
  actorName: string;
  allowedAreaIds?: string[];
}

export interface AttachmentBinding {
  businessType: AttachmentBusinessType;
  businessId: string;
  areaId: string;
  boundAt: string;
}

export interface AttachmentView {
  id: string;
  originalName: string;
  contentType: string;
  size: number;
  sha256: string;
  uploader: string;
  areaId: string;
  businessType?: AttachmentBusinessType;
  businessId?: string;
  status: 'uploaded' | 'bound';
  createdAt: string;
  boundAt?: string;
  downloadUrl: string;
}
