import RoomClient from "@/components/room/RoomClient";

type RoomPageProps = {
  params: { id: string };
};

export default function RoomPage({ params }: RoomPageProps) {
  return <RoomClient roomId={params.id} />;
}
