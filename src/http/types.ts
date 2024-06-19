export type HTTPResponse = {
  success: boolean;
  message: string;
  data: Data;
};

interface Data {
  records: object[]; // List of records of the entity
  delay: number; // Delay in seconds(used for ratelimiting), Time to wait before next call
  nextPage?: number; // The next page of the entity to be processed
  metadata?: object; // Other information that should be returned
}
