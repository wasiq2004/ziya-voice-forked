import { Type } from "@google/genai";

export enum Page {
    Dashboard = 'Dashboard',
    Campaigns = 'Campaigns',
    Agent = 'Agent',
    PhoneNo = 'Phone Numbers',
    Settings = 'User Profile',
    API = 'API',
    Credits = 'Credits',
    Schedule = 'Schedule',
    Reports = 'Reports',
    AdminDashboard = 'Admin Dashboard',
    AdminUsers = 'Users',
    AdminPlans = 'Plans',
}

export enum CampaignStatus {
    Active = 'Active',
    Paused = 'Paused',
    Completed = 'Completed',
    Idle = 'idle',
    Running = 'running',
}

export interface Campaign {
    id: string;
    userId: string;
    name: string;
    callerPhone?: string;
    includeMetadata: boolean;
    status: CampaignStatus;
    leads: number;
    contacts: number;
    createdAt: string; // ISO string
}

export interface CampaignRecord {
    id: string;
    campaignId: string;
    phone: string;
    callStatus: 'pending' | 'in-progress' | 'completed' | 'failed';
    createdAt: string; // ISO string
}

export enum VoiceAgentStatus {
    Active = 'Active',
    Inactive = 'Inactive',
}

export enum ToolType {
    Webhook = 'Webhook',
    WebForm = 'Web Form',
    GoogleSheets = 'Google Sheets',
}

export enum PreActionPhraseMode {
    Disable = 'disable',
    Flexible = 'flexible',
    Strict = 'strict',
}

export interface ToolParameter {
    name: string;
    type: 'string' | 'number' | 'boolean';
    required: boolean;
}

export interface ToolHeader {
    key: string;
    value: string;
}

export interface Tool {
    id: string;
    name: string;
    description: string;
    type: ToolType;
    webhookUrl?: string;
    method?: 'GET' | 'POST';
    runAfterCall?: boolean;
    preActionPhrasesMode: PreActionPhraseMode;
    preActionPhrases: string[];
    parameters?: ToolParameter[];
    headers?: ToolHeader[];
}


export interface VoiceAgentSettings {
    userStartsFirst: boolean;
    greetingLine: string;
    responseDelay: boolean;
    inactivityHandling: boolean;
    agentCanTerminateCall: boolean;
    voicemailDetection: boolean;
    callTransfer: boolean;
    dtmfDial: boolean;
    agentTimezone: string;
    voiceDetectionConfidenceThreshold: number;
    overrideVAD: boolean;
    backgroundAmbientSound: string;
    callRecording: boolean;
    sessionTimeoutFixedDuration: number;
    sessionTimeoutNoVoiceActivity: number;
    sessionTimeoutEndMessage: string;
    dataPrivacyOptOut: boolean;
    doNotCallDetection: boolean;
    prefetchDataWebhook: string;
    endOfCallWebhook: string;
    dataCollectionSheetUrl?: string; // Google Sheets URL for automatic data collection
    preActionPhrases: string[]; // For knowledge base
    tools: Tool[];
    knowledgeDocIds?: string[];
    webhookEnabled?: boolean; // Enable webhook delivery after each call
    webhookUrl?: string; // Webhook endpoint URL
}


export interface VoiceAgent {
    id: string;
    name: string;
    identity: string;
    createdDate: string;
    status: VoiceAgentStatus;
    model: string;
    voiceId: string;
    language: string;
    settings: VoiceAgentSettings;
    hasPhoneNumber?: boolean; // true if a phone number is mapped to this agent
}

export enum PhoneProvider {
    Twilio = 'Twilio',
    Evotel = 'Evotel',
}

export interface PhoneNumber {
    id: string;
    number: string;
    phoneNumber?: string; // Some parts of the code use this
    phone_number?: string; // Some parts of the code use this
    countryCode: string;
    source: string;
    agentName: string;
    agentId: string;
    region: string;
    createdDate: string; // ISO string
    nextCycle: string;
    provider: PhoneProvider;
    twilioSid?: string;
}

export interface Plan {
    id: string;
    plan_name: string;
    credit_limit: number;
    validity_days: number;
    plan_type?: string | null;
    created_at: string;
    updated_at: string;
}

export interface AppSettings {
    agentName: string;
    language: string;
    voiceType: string;
    prefetchDataWebhook: string;
    endOfCallWebhook: string;
}