/** 장기요양등급. 계약서(.unlazy-contract.md) enum과 1:1로 맞춘다. */
export type CareGrade = 'GRADE_1' | 'GRADE_2' | 'GRADE_3' | 'GRADE_4' | 'GRADE_5' | 'COGNITIVE_SUPPORT' | 'NONE';
export type Gender = 'MALE' | 'FEMALE';
export type DiaperType = 'NONE' | 'PANTY' | 'PAD' | 'BOTH';
export type CognitionLevel = 'NORMAL' | 'MILD' | 'MODERATE' | 'SEVERE';
export type MealType = 'REGULAR' | 'CHOPPED' | 'PORRIDGE' | 'MIXED';

/**
 * 어르신 케어 정보 — 서버가 돌려주는 모양.
 *
 * 주민번호는 여기에 절대 평문으로 오지 않는다. 목록에는 마스킹본만 실리고,
 * 전체 번호는 관리자가 따로 요청할 때만(revealElderResidentNumber) 내려온다.
 */
export interface ElderCareProfile {
  /** "410203-2******" — 미등록이면 null */
  residentNumberMasked?: string | null;
  birthDate?: string | null;
  gender?: Gender | null;
  /** 서버가 birthDate로 계산한 만 나이 (응답 전용) */
  age?: number | null;
  careGrade?: CareGrade | null;

  fallRisk?: boolean;
  fallNote?: string | null;
  pressureSore?: boolean;
  pressureSoreNote?: string | null;
  diaperType?: DiaperType | null;
  diaperIntermittent?: boolean;
  cognitionLevel?: CognitionLevel | null;
  cognitionNote?: string | null;

  mealType?: MealType | null;
  morningSnack?: boolean;
  afternoonSnack?: boolean;
  dinner?: boolean;
  mealNote?: string | null;

  bathTime?: string | null;
  bathNote?: string | null;

  medMorning?: boolean;
  medMorningTime?: string | null;
  medLunch?: boolean;
  medLunchTime?: string | null;
  medEvening?: boolean;
  medEveningTime?: string | null;
  medNote?: string | null;

  vehicleNote?: string | null;
  floor?: number | null;
  seatNote?: string | null;
  careNote?: string | null;

  updatedAt?: string | null;
}

/**
 * 요청으로 보내는 모양 — 응답 전용 필드(마스킹본·나이·수정시각)가 빠지고
 * 평문 주민번호가 들어온다.
 *
 * residentNumber 규약이 3값이라는 점이 중요하다:
 *   undefined/null = 기존 값 유지, "" = 삭제, 13자리 = 교체.
 * 화면이 "안 건드렸다"와 "지웠다"를 구분해 보내지 않으면 열어보기만 해도 번호가 날아간다.
 */
export interface ElderCareProfileInput extends Omit<ElderCareProfile, 'residentNumberMasked' | 'age' | 'updatedAt'> {
  residentNumber?: string | null;
}

export interface ElderlyInfo {
  id: number;
  name: string;
  homeAddressName?: string;
  homeAddress?: {
    latitude: number;
    longitude: number;
  };
  requiredFrontSeat: boolean;
  /** 케어 정보가 등록되지 않았으면 null */
  careProfile?: ElderCareProfile | null;
}
