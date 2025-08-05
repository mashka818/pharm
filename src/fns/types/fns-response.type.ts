export interface ReceiptCheckResult {
  isValid: boolean;
  isReturn: boolean;
  isFake: boolean;
  receiptData?: ReceiptData;
  error?: string;
  processingStatus?: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  status?: 'pending' | 'processing' | 'success' | 'rejected' | 'failed';
}

export interface ReceiptData {
  id?: string;
  ofdId?: string;
  sum?: number;
  date?: string;
  fn?: string;
  fd?: string;
  fp?: string;
  items?: ReceiptItem[];
}

export interface ReceiptItem {
  name: string;
  price: number;
  quantity: number;
  sum: number;
}

export interface FnsAuthResponse {
  token: string;
  expiresAt: string;
}

export interface FnsSendMessageResponse {
  messageId: string;
}

export interface FnsGetMessageResponse {
  processingStatus: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  message?: any;
  error?: string;
} 