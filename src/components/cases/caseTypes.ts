import functionUrls from '../../../backend/func2url.json';

export const casesApi = (functionUrls as Record<string, string>)['landing-cases'];

export interface LandingCase {
  id: number;
  task: string;
  company_name: string;
  logo_url: string | null;
  niche: string;
  solution: string;
  created_at: string;
}
