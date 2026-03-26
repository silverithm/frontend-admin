export interface ElderlyInfo {
  id: number;
  name: string;
  homeAddressName?: string;
  homeAddress?: {
    latitude: number;
    longitude: number;
  };
  requiredFrontSeat: boolean;
}
