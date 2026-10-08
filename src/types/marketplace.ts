export type ListingCondition = "new" | "like_new" | "used" | "not_applicable";
export type ListingStatus = "active" | "sold" | "inactive";
export type Category = { id: string; name: string; is_service: boolean };
export type ListingImage = { id: string; position: number; url: string | null };
export type ListingSeller = {
  id: string;
  username: string | null;
  name: string;
  course: string | null;
  semester: number | null;
  institution: string | null;
  avatar_url: string | null;
};
export type Listing = {
  id: string;
  title: string;
  description: string;
  price: string;
  condition: ListingCondition;
  status: ListingStatus;
  created_at: string;
  category: Category;
  seller: ListingSeller;
  images: ListingImage[];
};
export type MarketplaceParams = Record<string, string | string[] | undefined>;
export type MarketplaceState = {
  id?: string;
  error?: string;
  success?: string;
  fields?: Record<string, string[] | undefined>;
};
